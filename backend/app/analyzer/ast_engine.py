"""
Deterministic Static Analysis Engine using Python AST parsing.
Walks the Abstract Syntax Tree of target files to detect OpenAI SDK v0.x patterns.
"""
import ast
from typing import Dict, List, Optional

from pydantic import BaseModel

from app.rules.openai_v0_v1 import (
    AutomationStatus,
    FindingCategory,
    FindingSeverity,
    OPENAI_MIGRATION_RULES,
)


class Finding(BaseModel):
    id: str
    rule_id: str
    file_path: str
    line_number: int
    column_offset: int
    end_line_number: Optional[int] = None
    end_column_offset: Optional[int] = None
    code_snippet: str
    suggested_replacement: str
    category: FindingCategory
    severity: FindingSeverity
    automation: AutomationStatus
    rule_name: str
    description: str
    why_changed: str
    migration_advice: str
    # The codemod uses this to replace an aliased expression precisely.
    source_expression: Optional[str] = None


class OpenAISDKVisitor(ast.NodeVisitor):
    def __init__(self, file_path: str, source_code: str):
        self.file_path = file_path
        self.source_code = source_code
        self.source_lines = source_code.splitlines()
        self.findings: List[Finding] = []
        self._finding_count = 0
        self.openai_module_names = {"openai"}
        self.openai_resource_aliases: Dict[str, str] = {}
        self.openai_error_aliases = set()
        self._awaited_call_ids = set()

    def _get_snippet(self, node: ast.AST) -> str:
        line_no = getattr(node, "lineno", 1) - 1
        if 0 <= line_no < len(self.source_lines):
            return self.source_lines[line_no].strip()
        return ""

    def _add_finding(
        self,
        rule_id: str,
        node: ast.AST,
        custom_replacement: str,
        snippet: Optional[str] = None,
        source_expression: Optional[str] = None,
    ):
        rule = OPENAI_MIGRATION_RULES.get(rule_id)
        if not rule:
            return

        self._finding_count += 1
        finding = Finding(
            id=f"FINDING-{self._finding_count:04d}",
            rule_id=rule.id,
            file_path=self.file_path,
            line_number=getattr(node, "lineno", 1),
            column_offset=getattr(node, "col_offset", 0),
            end_line_number=getattr(node, "end_lineno", getattr(node, "lineno", 1)),
            end_column_offset=getattr(node, "end_col_offset", getattr(node, "col_offset", 0)),
            code_snippet=snippet or self._get_snippet(node),
            suggested_replacement=custom_replacement,
            category=rule.category,
            severity=rule.severity,
            automation=rule.automation,
            rule_name=rule.name,
            description=rule.description,
            why_changed=rule.why_changed,
            migration_advice=rule.migration_advice,
            source_expression=source_expression,
        )
        self.findings.append(finding)

    def visit_Import(self, node: ast.Import):
        for alias in node.names:
            if alias.name == "openai":
                local_name = alias.asname or "openai"
                self.openai_module_names.add(local_name)
                self._add_finding(
                    "RULE-IMPORT-001",
                    node,
                    "from openai import OpenAI",
                    source_expression=local_name,
                )
        self.generic_visit(node)

    def visit_ImportFrom(self, node: ast.ImportFrom):
        if node.module == "openai":
            for alias in node.names:
                local_name = alias.asname or alias.name
                if alias.name == "error":
                    self.openai_error_aliases.add(local_name)
                    self._add_finding(
                        "RULE-EXCEPT-001",
                        node,
                        "import openai",
                        source_expression=local_name,
                    )
                elif alias.name in ("ChatCompletion", "Completion", "Embedding", "Audio", "Image", "Model"):
                    self.openai_resource_aliases[local_name] = alias.name
                    self._add_finding(
                        "RULE-IMPORT-001",
                        node,
                        "from openai import OpenAI",
                        source_expression=local_name,
                    )
        elif node.module == "openai.error":
            self._add_finding(
                "RULE-EXCEPT-001",
                node,
                "from openai import APIError, RateLimitError, BadRequestError",
                source_expression=node.module,
            )
        self.generic_visit(node)

    def visit_Assign(self, node: ast.Assign):
        for target in node.targets:
            if not isinstance(target, ast.Attribute) or not isinstance(target.value, ast.Name):
                continue

            if target.value.id not in self.openai_module_names:
                continue

            if target.attr == "api_key":
                self._add_finding(
                    "RULE-CONFIG-001",
                    node,
                    "client = OpenAI() # Or pass api_key= inside OpenAI constructor",
                    snippet=self._get_snippet(node),
                    source_expression=f"{target.value.id}.{target.attr}",
                )
            elif target.attr in ("api_base", "organization"):
                self._add_finding(
                    "RULE-CONFIG-002",
                    node,
                    "client = OpenAI(base_url=..., organization=...)",
                    snippet=self._get_snippet(node),
                    source_expression=f"{target.value.id}.{target.attr}",
                )
            elif target.attr in ("api_version", "api_type"):
                self._add_finding(
                    "RULE-UNSUPPORTED-001",
                    node,
                    "# Manual Review: api_version/api_type require an AzureOpenAI client decision",
                    snippet=self._get_snippet(node),
                    source_expression=f"{target.value.id}.{target.attr}",
                )
        self.generic_visit(node)

    def visit_Await(self, node: ast.Await):
        if isinstance(node.value, ast.Call):
            self._awaited_call_ids.add(id(node.value))
        self.generic_visit(node)

    def visit_Call(self, node: ast.Call):
        if isinstance(node.func, ast.Name) and node.func.id == "getattr":
            if node.args and isinstance(node.args[0], ast.Name) and node.args[0].id in self.openai_module_names:
                self._add_finding(
                    "RULE-UNSUPPORTED-001",
                    node,
                    "# Manual Review: Dynamic call to openai module detected",
                    source_expression=node.args[0].id,
                )

        func_str = self._get_attribute_chain(node.func)
        if func_str:
            resource, method = self._resolve_legacy_call(func_str)
            if resource == "ChatCompletion" and method == "create":
                self._add_finding(
                    "RULE-CHAT-001",
                    node,
                    self._transform_call_string(node, "client.chat.completions.create"),
                    source_expression=func_str,
                )
            elif resource == "ChatCompletion" and method == "acreate":
                if id(node) in self._awaited_call_ids:
                    self._add_finding(
                        "RULE-CHAT-002",
                        node,
                        self._transform_call_string(node, "async_client.chat.completions.create"),
                        source_expression=func_str,
                    )
                else:
                    self._add_finding(
                        "RULE-UNSUPPORTED-001",
                        node,
                        "# Manual Review: async OpenAI call must be awaited",
                        source_expression=func_str,
                    )
            elif resource == "Completion" and method == "create":
                self._add_finding(
                    "RULE-COMP-001",
                    node,
                    self._transform_call_string(node, "client.completions.create"),
                    source_expression=func_str,
                )
            elif resource == "Embedding" and method == "create":
                self._add_finding(
                    "RULE-EMBED-001",
                    node,
                    self._transform_call_string(node, "client.embeddings.create"),
                    source_expression=func_str,
                )
            elif resource == "Audio" and method == "transcribe":
                self._add_finding(
                    "RULE-AUDIO-001",
                    node,
                    self._transform_call_string(node, "client.audio.transcriptions.create"),
                    source_expression=func_str,
                )
            elif resource == "Audio" and method == "translate":
                self._add_finding(
                    "RULE-AUDIO-002",
                    node,
                    self._transform_call_string(node, "client.audio.translations.create"),
                    source_expression=func_str,
                )
            elif resource == "Image" and method in ("create", "create_variation", "create_edit"):
                image_target = {
                    "create": "client.images.generate",
                    "create_variation": "client.images.create_variation",
                    "create_edit": "client.images.edit",
                }[method]
                self._add_finding(
                    "RULE-IMAGE-001",
                    node,
                    self._transform_call_string(node, image_target),
                    source_expression=func_str,
                )
            elif resource == "Model" and method in ("list", "retrieve"):
                self._add_finding(
                    "RULE-MODEL-001",
                    node,
                    self._transform_call_string(node, f"client.models.{method}"),
                    source_expression=func_str,
                )
            elif method == "acreate" and resource in {"Completion", "Embedding", "Audio", "Image"}:
                self._add_finding(
                    "RULE-UNSUPPORTED-001",
                    node,
                    "# Manual Review: use the matching AsyncOpenAI resource explicitly",
                    source_expression=func_str,
                )

        self.generic_visit(node)

    def visit_ExceptHandler(self, node: ast.ExceptHandler):
        if node.type:
            exception_nodes = [node.type]
            if isinstance(node.type, ast.Tuple):
                exception_nodes = [item for item in node.type.elts if isinstance(item, ast.AST)]

            for exception_node in exception_nodes:
                exc_str = self._get_attribute_chain(exception_node)
                if exc_str and self._is_legacy_exception(exc_str):
                    self._add_finding(
                        "RULE-EXCEPT-001",
                        exception_node,
                        f"except {self._transform_exception_string(exc_str)}:",
                        snippet=self._get_snippet(node),
                        source_expression=exc_str,
                    )
        self.generic_visit(node)

    def _resolve_legacy_call(self, func_str: str):
        parts = func_str.split(".")
        if len(parts) == 3 and parts[0] in self.openai_module_names:
            return parts[1], parts[2]
        if len(parts) == 2 and parts[0] in self.openai_resource_aliases:
            return self.openai_resource_aliases[parts[0]], parts[1]
        return None, None

    def _is_legacy_exception(self, exc_str: str) -> bool:
        parts = exc_str.split(".")
        return (
            len(parts) >= 3
            and parts[0] in self.openai_module_names
            and parts[1] == "error"
        ) or (len(parts) == 2 and parts[0] in self.openai_error_aliases)

    def _transform_exception_string(self, exc_str: str) -> str:
        exception_map = {
            "OpenAIError": "APIError",
            "InvalidRequestError": "BadRequestError",
            "AuthenticationError": "AuthenticationError",
            "RateLimitError": "RateLimitError",
            "ServiceUnavailableError": "APIConnectionError",
        }
        parts = exc_str.split(".")
        new_name = exception_map.get(parts[-1], parts[-1])
        if len(parts) >= 3 and parts[0] in self.openai_module_names and parts[1] == "error":
            return f"{parts[0]}.{new_name}"
        return f"openai.{new_name}"

    def _get_attribute_chain(self, node: ast.AST) -> Optional[str]:
        if isinstance(node, ast.Name):
            return node.id
        if isinstance(node, ast.Attribute):
            value = self._get_attribute_chain(node.value)
            if value:
                return f"{value}.{node.attr}"
        return None

    def _transform_call_string(self, node: ast.Call, new_func_prefix: str) -> str:
        original = self._get_snippet(node)
        func_chain = self._get_attribute_chain(node.func)
        if func_chain and original:
            return original.replace(func_chain, new_func_prefix)
        return f"{new_func_prefix}(...)"


def analyze_code(file_path: str, source_code: str) -> List[Finding]:
    """
    Parse Python code into AST and run OpenAISDKVisitor.
    Returns a list of findings and safely reports invalid Python syntax.
    """
    try:
        tree = ast.parse(source_code, filename=file_path)
    except SyntaxError as e:
        return [
            Finding(
                id="FINDING-SYNTAX-ERR",
                rule_id="RULE-UNSUPPORTED-001",
                file_path=file_path,
                line_number=e.lineno or 1,
                column_offset=e.offset or 0,
                code_snippet=e.text or "",
                suggested_replacement="",
                category=FindingCategory.UNSUPPORTED_PATTERN,
                severity=FindingSeverity.HIGH,
                automation=AutomationStatus.MANUAL_REVIEW,
                rule_name="Syntax Error during parsing",
                description=f"SyntaxError encountered while parsing file: {e.msg}",
                why_changed="Static analysis requires valid Python syntax.",
                migration_advice="Fix syntax error before analyzing migration candidates.",
            )
        ]

    visitor = OpenAISDKVisitor(file_path=file_path, source_code=source_code)
    visitor.visit(tree)
    return visitor.findings

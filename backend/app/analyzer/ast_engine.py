"""
Deterministic Static Analysis Engine using Python AST parsing.
Walks the Abstract Syntax Tree of target files to detect OpenAI SDK v0.x patterns.
"""
import ast
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from app.rules.openai_v0_v1 import (
    OPENAI_MIGRATION_RULES,
    Rule,
    FindingCategory,
    FindingSeverity,
    AutomationStatus
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

class OpenAISDKVisitor(ast.NodeVisitor):
    def __init__(self, file_path: str, source_code: str):
        self.file_path = file_path
        self.source_code = source_code
        self.source_lines = source_code.splitlines()
        self.findings: List[Finding] = []
        self._finding_count = 0

    def _get_snippet(self, node: ast.AST) -> str:
        line_no = getattr(node, "lineno", 1) - 1
        if 0 <= line_no < len(self.source_lines):
            return self.source_lines[line_no].strip()
        return ""

    def _add_finding(self, rule_id: str, node: ast.AST, custom_replacement: str, snippet: Optional[str] = None):
        rule = OPENAI_MIGRATION_RULES.get(rule_id)
        if not rule:
            return

        self._finding_count += 1
        finding_id = f"FINDING-{self._finding_count:04d}"
        
        lineno = getattr(node, "lineno", 1)
        col_offset = getattr(node, "col_offset", 0)
        end_lineno = getattr(node, "end_lineno", lineno)
        end_col_offset = getattr(node, "end_col_offset", col_offset)

        code_snippet = snippet or self._get_snippet(node)

        finding = Finding(
            id=finding_id,
            rule_id=rule.id,
            file_path=self.file_path,
            line_number=lineno,
            column_offset=col_offset,
            end_line_number=end_lineno,
            end_column_offset=end_col_offset,
            code_snippet=code_snippet,
            suggested_replacement=custom_replacement,
            category=rule.category,
            severity=rule.severity,
            automation=rule.automation,
            rule_name=rule.name,
            description=rule.description,
            why_changed=rule.why_changed,
            migration_advice=rule.migration_advice
        )
        self.findings.append(finding)

    def visit_Import(self, node: ast.Import):
        for alias in node.names:
            if alias.name == "openai":
                self._add_finding(
                    "RULE-IMPORT-001",
                    node,
                    "from openai import OpenAI"
                )
        self.generic_visit(node)

    def visit_ImportFrom(self, node: ast.ImportFrom):
        if node.module == "openai":
            for alias in node.names:
                if alias.name == "error":
                    self._add_finding(
                        "RULE-EXCEPT-001",
                        node,
                        "import openai # Use openai.APIError, openai.RateLimitError etc directly"
                    )
                elif alias.name in ("ChatCompletion", "Completion", "Embedding", "Audio", "Image"):
                    self._add_finding(
                        "RULE-IMPORT-001",
                        node,
                        "from openai import OpenAI"
                    )
        elif node.module == "openai.error":
            self._add_finding(
                "RULE-EXCEPT-001",
                node,
                "from openai import APIError, RateLimitError, BadRequestError"
            )
        self.generic_visit(node)

    def visit_Assign(self, node: ast.Assign):
        for target in node.targets:
            if isinstance(target, ast.Attribute) and isinstance(target.value, ast.Name):
                if target.value.id == "openai":
                    if target.attr == "api_key":
                        # e.g. openai.api_key = "..."
                        val_str = self._get_snippet(node)
                        self._add_finding(
                            "RULE-CONFIG-001",
                            node,
                            "client = OpenAI() # Or pass api_key= inside OpenAI constructor",
                            snippet=val_str
                        )
                    elif target.attr in ("api_base", "organization", "api_version", "api_type"):
                        val_str = self._get_snippet(node)
                        self._add_finding(
                            "RULE-CONFIG-002",
                            node,
                            "client = OpenAI(base_url=..., organization=...)",
                            snippet=val_str
                        )
        self.generic_visit(node)

    def visit_Call(self, node: ast.Call):
        # Detect calls like getattr(openai, ...)
        if isinstance(node.func, ast.Name) and node.func.id == "getattr":
            if node.args and isinstance(node.args[0], ast.Name) and node.args[0].id == "openai":
                self._add_finding(
                    "RULE-UNSUPPORTED-001",
                    node,
                    "# Manual Review: Dynamic call to openai module detected"
                )

        # Detect calls like openai.ChatCompletion.create(...)
        func_str = self._get_attribute_chain(node.func)
        if func_str:
            if func_str == "openai.ChatCompletion.create":
                self._add_finding("RULE-CHAT-001", node, self._transform_call_string(node, "client.chat.completions.create"))
            elif func_str == "openai.ChatCompletion.acreate":
                self._add_finding("RULE-CHAT-002", node, self._transform_call_string(node, "await async_client.chat.completions.create"))
            elif func_str == "openai.Completion.create":
                self._add_finding("RULE-COMP-001", node, self._transform_call_string(node, "client.completions.create"))
            elif func_str == "openai.Embedding.create":
                self._add_finding("RULE-EMBED-001", node, self._transform_call_string(node, "client.embeddings.create"))
            elif func_str == "openai.Audio.transcribe":
                self._add_finding("RULE-AUDIO-001", node, self._transform_call_string(node, "client.audio.transcriptions.create"))
            elif func_str == "openai.Audio.translate":
                self._add_finding("RULE-AUDIO-002", node, self._transform_call_string(node, "client.audio.translations.create"))
            elif func_str in ("openai.Image.create", "openai.Image.create_variation", "openai.Image.create_edit"):
                self._add_finding("RULE-IMAGE-001", node, self._transform_call_string(node, "client.images.generate"))
            elif func_str in ("openai.Model.list", "openai.Model.retrieve"):
                self._add_finding("RULE-MODEL-001", node, self._transform_call_string(node, "client.models.list"))

        self.generic_visit(node)

    def visit_ExceptHandler(self, node: ast.ExceptHandler):
        if node.type:
            exc_str = self._get_attribute_chain(node.type)
            if exc_str and exc_str.startswith("openai.error"):
                replacement = exc_str.replace("openai.error.OpenAIError", "openai.APIError")\
                                      .replace("openai.error.InvalidRequestError", "openai.BadRequestError")\
                                      .replace("openai.error.AuthenticationError", "openai.AuthenticationError")\
                                      .replace("openai.error.RateLimitError", "openai.RateLimitError")\
                                      .replace("openai.error.ServiceUnavailableError", "openai.APIConnectionError")\
                                      .replace("openai.error.", "openai.")
                self._add_finding(
                    "RULE-EXCEPT-001",
                    node,
                    f"except {replacement}:",
                    snippet=self._get_snippet(node)
                )
        self.generic_visit(node)

    def _get_attribute_chain(self, node: ast.AST) -> Optional[str]:
        if isinstance(node, ast.Name):
            return node.id
        elif isinstance(node, ast.Attribute):
            val = self._get_attribute_chain(node.value)
            if val:
                return f"{val}.{node.attr}"
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
    Returns list of Findings. Safe error handling for invalid Python syntax.
    """
    try:
        tree = ast.parse(source_code, filename=file_path)
    except SyntaxError as e:
        # Return syntax error finding
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
                migration_advice="Fix syntax error before analyzing migration candidates."
            )
        ]

    visitor = OpenAISDKVisitor(file_path=file_path, source_code=source_code)
    visitor.visit(tree)
    return visitor.findings

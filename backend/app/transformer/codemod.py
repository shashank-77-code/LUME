"""
Code Transformation Engine & Unified Diff Generator.
Applies deterministic code edits based on AST findings.
"""
import ast
import difflib
import re
from typing import Dict, List, Set, Tuple

from app.analyzer.ast_engine import AutomationStatus, Finding


SYNC_CALL_RULES = {
    "RULE-CHAT-001",
    "RULE-COMP-001",
    "RULE-EMBED-001",
    "RULE-AUDIO-001",
    "RULE-AUDIO-002",
    "RULE-IMAGE-001",
    "RULE-MODEL-001",
}


def _indent(line: str) -> str:
    return line[: len(line) - len(line.lstrip())]


def _exception_target(source_expression: str) -> str:
    exception_map = {
        "OpenAIError": "APIError",
        "InvalidRequestError": "BadRequestError",
        "AuthenticationError": "AuthenticationError",
        "RateLimitError": "RateLimitError",
        "ServiceUnavailableError": "APIConnectionError",
    }
    parts = source_expression.split(".")
    new_name = exception_map.get(parts[-1], parts[-1])
    if len(parts) >= 3 and parts[1] == "error":
        return f"{parts[0]}.{new_name}"
    return f"openai.{new_name}"


def _call_target(finding: Finding) -> str:
    source = finding.source_expression or ""
    if finding.rule_id == "RULE-CHAT-001":
        return "client.chat.completions.create"
    if finding.rule_id == "RULE-CHAT-002":
        return "async_client.chat.completions.create"
    if finding.rule_id == "RULE-COMP-001":
        return "client.completions.create"
    if finding.rule_id == "RULE-EMBED-001":
        return "client.embeddings.create"
    if finding.rule_id == "RULE-AUDIO-001":
        return "client.audio.transcriptions.create"
    if finding.rule_id == "RULE-AUDIO-002":
        return "client.audio.translations.create"
    if finding.rule_id == "RULE-IMAGE-001":
        if source.endswith(".create_variation"):
            return "client.images.create_variation"
        if source.endswith(".create_edit"):
            return "client.images.edit"
        return "client.images.generate"
    if finding.rule_id == "RULE-MODEL-001":
        return f"client.models.{source.rsplit('.', 1)[-1]}"
    return ""


def _replace_expression(line: str, finding: Finding, replacement: str) -> str:
    source_expression = finding.source_expression
    if source_expression and source_expression in line:
        return line.replace(source_expression, replacement, 1)
    return line


def _rewrite_error_import(line: str) -> str:
    match = re.match(r"^(\s*)from\s+openai\.error\s+import\s+(.+?)\s*$", line)
    if not match:
        return line

    names = []
    for item in match.group(2).split(","):
        item = item.strip()
        if not item:
            continue
        parts = re.split(r"\s+as\s+", item, maxsplit=1)
        old_name = parts[0]
        new_name = {
            "OpenAIError": "APIError",
            "InvalidRequestError": "BadRequestError",
            "ServiceUnavailableError": "APIConnectionError",
        }.get(old_name, old_name)
        names.append(f"{new_name} as {parts[1]}" if len(parts) == 2 else new_name)
    return f"{match.group(1)}from openai import {', '.join(names)}"


def _rewrite_openai_import(line: str, preserve_legacy_import: bool, client_import: str) -> str:
    if preserve_legacy_import and re.match(r"^\s*import\s+openai(?:\s+as\s+\w+)?\s*$", line):
        return line

    if preserve_legacy_import and re.match(r"^\s*from\s+openai\s+import\s+error(?:\s+as\s+\w+)?\s*$", line):
        return "import openai"

    if re.match(r"^\s*import\s+openai(?:\s+as\s+\w+)?\s*$", line):
        return f"from openai import {client_import}"

    match = re.match(r"^(\s*)from\s+openai\s+import\s+(.+?)\s*$", line)
    if match:
        imported = [part.strip() for part in match.group(2).split(",")]
        if any(re.match(r"(?:error|ChatCompletion|Completion|Embedding|Audio|Image|Model)(?:\s+as\s+\w+)?$", part) for part in imported):
            return f"{match.group(1)}from openai import {client_import}"
    return line


def _find_config_values(lines: List[str], findings: List[Finding]) -> Dict[str, Tuple[int, str, str]]:
    values: Dict[str, Tuple[int, str, str]] = {}
    config_names = {
        "api_key": "api_key",
        "api_base": "base_url",
        "organization": "organization",
    }
    for finding in findings:
        if finding.rule_id not in {"RULE-CONFIG-001", "RULE-CONFIG-002"}:
            continue
        index = finding.line_number - 1
        if not 0 <= index < len(lines) or "=" not in lines[index]:
            continue
        source = finding.source_expression or ""
        attr = source.rsplit(".", 1)[-1]
        if attr not in config_names:
            continue
        rhs = lines[index].split("=", 1)[1].strip()
        values.setdefault(config_names[attr], (index, _indent(lines[index]), rhs))
    return values


def _insertion_index(lines: List[str]) -> int:
    try:
        tree = ast.parse("\n".join(lines))
    except SyntaxError:
        return 0

    insert_at = 0
    for node in tree.body:
        if isinstance(node, ast.Expr) and isinstance(getattr(node, "value", None), ast.Constant) and isinstance(node.value.value, str):
            insert_at = node.end_lineno or node.lineno
        elif isinstance(node, (ast.Import, ast.ImportFrom)):
            insert_at = node.end_lineno or node.lineno
        else:
            break
    return insert_at


def _ensure_setup(lines: List[str], needs_sync: bool, needs_async: bool, needs_module: bool, has_config: bool) -> List[str]:
    required_imports: List[str] = []
    existing_text = "\n".join(lines)

    if needs_sync and not re.search(r"^\s*from\s+openai\s+import\s+[^\n]*\bOpenAI\b", existing_text, re.MULTILINE):
        required_imports.append("from openai import OpenAI")
    if needs_async and not re.search(r"^\s*from\s+openai\s+import\s+[^\n]*\bAsyncOpenAI\b", existing_text, re.MULTILINE):
        required_imports.append("from openai import AsyncOpenAI")
    if needs_module and not re.search(r"^\s*import\s+openai(?:\s+as\s+\w+)?\s*$", existing_text, re.MULTILINE):
        required_imports.append("import openai")

    setup_lines: List[str] = list(required_imports)
    if needs_sync and not has_config and not re.search(r"^\s*client\s*=\s*OpenAI\(", existing_text, re.MULTILINE):
        setup_lines.append("client = OpenAI()")
    if needs_async and not re.search(r"^\s*async_client\s*=\s*AsyncOpenAI\(", existing_text, re.MULTILINE):
        setup_lines.append("async_client = AsyncOpenAI()")

    if not setup_lines:
        return lines
    insert_at = _insertion_index(lines)
    prefix = setup_lines + ([""] if insert_at < len(lines) else [])
    return lines[:insert_at] + prefix + lines[insert_at:]


def transform_source_code(source_code: str, findings: List[Finding]) -> Tuple[str, str, List[Finding]]:
    """
    Applies automatic findings and returns (transformed_code, diff_text, applied_findings).

    Unsupported findings intentionally leave their original code and imports intact.
    This keeps a partially migrated file executable instead of replacing a legacy
    symbol with an undefined client expression.
    """
    original_lines = source_code.splitlines()
    modified_lines = list(original_lines)
    applied_findings: List[Finding] = []
    applied_ids: Set[str] = set()
    manual_review = any(f.automation == AutomationStatus.MANUAL_REVIEW for f in findings)
    has_config = any(f.rule_id in {"RULE-CONFIG-001", "RULE-CONFIG-002"} for f in findings)
    config_values = _find_config_values(original_lines, findings)

    needs_async = any(f.rule_id == "RULE-CHAT-002" and f.automation != AutomationStatus.MANUAL_REVIEW for f in findings)
    needs_sync = any(
        f.automation != AutomationStatus.MANUAL_REVIEW
        and (f.rule_id in SYNC_CALL_RULES or f.rule_id in {"RULE-CONFIG-001", "RULE-CONFIG-002"})
        for f in findings
    )
    if not manual_review and not needs_async and any(f.rule_id == "RULE-IMPORT-001" for f in findings):
        needs_sync = True
    client_import = "OpenAI, AsyncOpenAI" if needs_sync and needs_async else ("AsyncOpenAI" if needs_async else "OpenAI")
    needs_module = manual_review or any(f.rule_id == "RULE-EXCEPT-001" for f in findings)

    # Combine global configuration assignments into one valid client constructor.
    if config_values:
        first_index = min(value[0] for value in config_values.values())
        first_indent = _indent(original_lines[first_index])
        ordered_kwargs = []
        for key, (_, _, value) in sorted(config_values.items(), key=lambda item: item[1][0]):
            ordered_kwargs.append(f"{key}={value}")
        modified_lines[first_index] = f"{first_indent}client = OpenAI({', '.join(ordered_kwargs)})"
        for finding in findings:
            if finding.rule_id in {"RULE-CONFIG-001", "RULE-CONFIG-002"}:
                index = finding.line_number - 1
                if index != first_index and 0 <= index < len(modified_lines):
                    modified_lines[index] = f"{_indent(original_lines[index])}# LUME: merged into client initialization"
                applied_findings.append(finding)
                applied_ids.add(finding.id)

    findings_by_line: Dict[int, List[Finding]] = {}
    for finding in findings:
        findings_by_line.setdefault(finding.line_number - 1, []).append(finding)

    for line_index in sorted(findings_by_line, reverse=True):
        if not 0 <= line_index < len(modified_lines):
            continue
        line_findings = findings_by_line[line_index]
        original_line = original_lines[line_index]
        line = modified_lines[line_index]

        if any(f.rule_id in {"RULE-IMPORT-001", "RULE-EXCEPT-001"} and original_line.lstrip().startswith(("import ", "from ")) for f in line_findings):
            line = _rewrite_error_import(original_line)
            line = _rewrite_openai_import(line, manual_review or needs_module, client_import)
            modified_lines[line_index] = line
            for finding in line_findings:
                if finding.rule_id in {"RULE-IMPORT-001", "RULE-EXCEPT-001"} and finding.automation != AutomationStatus.MANUAL_REVIEW:
                    applied_findings.append(finding)
                    applied_ids.add(finding.id)
            continue

        for finding in line_findings:
            if finding.id in applied_ids or finding.automation == AutomationStatus.MANUAL_REVIEW:
                continue
            if finding.rule_id in {"RULE-CONFIG-001", "RULE-CONFIG-002"}:
                continue

            if finding.rule_id in SYNC_CALL_RULES or finding.rule_id == "RULE-CHAT-002":
                line = _replace_expression(line, finding, _call_target(finding))
                applied_findings.append(finding)
                applied_ids.add(finding.id)
            elif finding.rule_id == "RULE-EXCEPT-001" and finding.source_expression:
                line = _replace_expression(line, finding, _exception_target(finding.source_expression))
                applied_findings.append(finding)
                applied_ids.add(finding.id)

        modified_lines[line_index] = line

    modified_lines = _ensure_setup(
        modified_lines,
        needs_sync=needs_sync,
        needs_async=needs_async,
        needs_module=needs_module,
        has_config=has_config,
    )

    transformed_code = "\n".join(modified_lines)
    diff_gen = difflib.unified_diff(
        [line + "\n" for line in original_lines],
        [line + "\n" for line in modified_lines],
        fromfile="v0_original.py",
        tofile="v1_migrated.py",
        lineterm="",
    )
    diff_text = "".join(diff_gen)
    return transformed_code, diff_text, applied_findings

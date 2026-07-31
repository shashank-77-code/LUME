"""
Code Transformation Engine & Unified Diff Generator.
Applies deterministic code edits based on AST findings.
"""
import difflib
from typing import List, Dict, Tuple, Any
from app.analyzer.ast_engine import Finding, AutomationStatus

def transform_source_code(source_code: str, findings: List[Finding]) -> Tuple[str, str, List[Finding]]:
    """
    Applies automatic findings to the source code and returns (transformed_code, diff_text, applied_findings).
    """
    lines = source_code.splitlines()
    applied_findings = []
    
    # Sort findings in reverse order of line number so line modifications don't shift line indices
    sorted_findings = sorted(findings, key=lambda f: (f.line_number, f.column_offset), reverse=True)
    
    modified_lines = list(lines)
    
    # Track if client import has been added
    needs_client_import = False
    needs_client_instantiation = False
    
    for finding in sorted_findings:
        if finding.automation == AutomationStatus.MANUAL_REVIEW:
            continue
            
        line_idx = finding.line_number - 1
        if 0 <= line_idx < len(modified_lines):
            orig_line = modified_lines[line_idx]
            
            # Apply specific line transformations
            if finding.rule_id == "RULE-IMPORT-001":
                if "import openai" in orig_line:
                    modified_lines[line_idx] = orig_line.replace("import openai", "from openai import OpenAI")
                    needs_client_instantiation = True
                    applied_findings.append(finding)
                elif "from openai import" in orig_line:
                    modified_lines[line_idx] = "from openai import OpenAI"
                    needs_client_instantiation = True
                    applied_findings.append(finding)

            elif finding.rule_id == "RULE-CONFIG-001":
                # e.g., openai.api_key = os.getenv(...)
                indent = orig_line[:len(orig_line) - len(orig_line.lstrip())]
                if "=" in orig_line:
                    rhs = orig_line.split("=", 1)[1].strip()
                    modified_lines[line_idx] = f"{indent}client = OpenAI(api_key={rhs})"
                else:
                    modified_lines[line_idx] = f"{indent}client = OpenAI()"
                applied_findings.append(finding)

            elif finding.rule_id == "RULE-CONFIG-002":
                indent = orig_line[:len(orig_line) - len(orig_line.lstrip())]
                modified_lines[line_idx] = f"{indent}# TODO (Lume Migration): Move configuration into client = OpenAI(...) constructor"
                applied_findings.append(finding)

            elif finding.rule_id == "RULE-CHAT-001":
                modified_lines[line_idx] = orig_line.replace("openai.ChatCompletion.create", "client.chat.completions.create")
                applied_findings.append(finding)

            elif finding.rule_id == "RULE-CHAT-002":
                modified_lines[line_idx] = orig_line.replace("openai.ChatCompletion.acreate", "client.chat.completions.create")
                applied_findings.append(finding)

            elif finding.rule_id == "RULE-COMP-001":
                modified_lines[line_idx] = orig_line.replace("openai.Completion.create", "client.completions.create")
                applied_findings.append(finding)

            elif finding.rule_id == "RULE-EMBED-001":
                modified_lines[line_idx] = orig_line.replace("openai.Embedding.create", "client.embeddings.create")
                applied_findings.append(finding)

            elif finding.rule_id == "RULE-AUDIO-001":
                modified_lines[line_idx] = orig_line.replace("openai.Audio.transcribe", "client.audio.transcriptions.create")
                applied_findings.append(finding)

            elif finding.rule_id == "RULE-AUDIO-002":
                modified_lines[line_idx] = orig_line.replace("openai.Audio.translate", "client.audio.translations.create")
                applied_findings.append(finding)

            elif finding.rule_id == "RULE-IMAGE-001":
                modified_lines[line_idx] = orig_line.replace("openai.Image.create", "client.images.generate")
                applied_findings.append(finding)

            elif finding.rule_id == "RULE-MODEL-001":
                modified_lines[line_idx] = orig_line.replace("openai.Model.list", "client.models.list")\
                                                    .replace("openai.Model.retrieve", "client.models.retrieve")
                applied_findings.append(finding)

            elif finding.rule_id == "RULE-EXCEPT-001":
                new_line = orig_line.replace("openai.error.OpenAIError", "openai.APIError")\
                                    .replace("openai.error.InvalidRequestError", "openai.BadRequestError")\
                                    .replace("openai.error.AuthenticationError", "openai.AuthenticationError")\
                                    .replace("openai.error.RateLimitError", "openai.RateLimitError")\
                                    .replace("openai.error.ServiceUnavailableError", "openai.APIConnectionError")\
                                    .replace("openai.error.", "openai.")
                modified_lines[line_idx] = new_line
                applied_findings.append(finding)

    transformed_code = "\n".join(modified_lines)
    
    # Generate unified diff
    orig_lines_with_newline = [l + "\n" for l in lines]
    mod_lines_with_newline = [l + "\n" for l in modified_lines]
    
    diff_gen = difflib.unified_diff(
        orig_lines_with_newline,
        mod_lines_with_newline,
        fromfile="v0_original.py",
        tofile="v1_migrated.py",
        lineterm=""
    )
    diff_text = "".join(diff_gen)

    return transformed_code, diff_text, applied_findings

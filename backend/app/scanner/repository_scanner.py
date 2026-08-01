"""
Repository Scanner module.
Discovers Python files in directories or ZIP archives and coordinates static analysis.
"""
import os
import ast
import zipfile
import tempfile
import shutil
from typing import List, Optional
from pydantic import BaseModel
from app.analyzer.ast_engine import analyze_code, Finding
from app.transformer.codemod import transform_source_code

class VerificationResult(BaseModel):
    valid: bool
    status: str
    error_message: Optional[str] = None
    line_number: Optional[int] = None
    column_number: Optional[int] = None

class ScannedFileResult(BaseModel):
    file_path: str
    original_code: str
    transformed_code: str
    diff_text: str
    findings: List[Finding]
    verification: VerificationResult

def verify_transformed_code(file_path: str, transformed_code: str) -> VerificationResult:
    """Validate transformed Python syntax without executing or importing the code."""
    try:
        ast.parse(transformed_code, filename=file_path)
    except SyntaxError as exc:
        return VerificationResult(
            valid=False,
            status="SYNTAX_INVALID",
            error_message=exc.msg,
            line_number=exc.lineno,
            column_number=exc.offset,
        )

    return VerificationResult(valid=True, status="SYNTAX_VALID")

def scan_directory(dir_path: str) -> List[ScannedFileResult]:
    """
    Recursively scans directory for .py files, runs AST analysis & codemod transformations.
    """
    results: List[ScannedFileResult] = []
    
    for root, _, files in os.walk(dir_path):
        for file in files:
            if file.endswith(".py") and not file.startswith("."):
                full_path = os.path.join(root, file)
                rel_path = os.path.relpath(full_path, dir_path).replace("\\", "/")
                
                try:
                    with open(full_path, "r", encoding="utf-8") as f:
                        source_code = f.read()
                except Exception as e:
                    continue

                findings = analyze_code(rel_path, source_code)
                transformed_code, diff_text, _ = transform_source_code(source_code, findings)

                results.append(
                    ScannedFileResult(
                        file_path=rel_path,
                        original_code=source_code,
                        transformed_code=transformed_code,
                        diff_text=diff_text,
                        findings=findings,
                        verification=verify_transformed_code(rel_path, transformed_code),
                    )
                )

    return results

def scan_zip_bytes(zip_bytes: bytes) -> List[ScannedFileResult]:
    """
    Extracts ZIP payload to temporary folder and scans Python files.
    """
    temp_dir = tempfile.mkdtemp(prefix="lume_zip_")
    try:
        zip_path = os.path.join(temp_dir, "repo.zip")
        with open(zip_path, "wb") as f:
            f.write(zip_bytes)
            
        with zipfile.ZipFile(zip_path, "r") as zip_ref:
            zip_ref.extractall(temp_dir)
            
        return scan_directory(temp_dir)
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)

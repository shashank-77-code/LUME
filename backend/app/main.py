"""
FastAPI Backend Application for Lume Migration Platform.
"""
import os
import shutil
from typing import List, Dict, Any, Optional
from fastapi import FastAPI, File, UploadFile, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.rules.openai_v0_v1 import OPENAI_MIGRATION_RULES, Rule
from app.analyzer.ast_engine import analyze_code, Finding
from app.transformer.codemod import transform_source_code
from app.explainer.ai_engine import generate_explanation, ExplanationResult
from app.reporter.generator import generate_report, generate_markdown_report, ReportData
from app.scanner.repository_scanner import (
    ScannedFileResult,
    scan_directory,
    scan_zip_bytes,
    verify_transformed_code,
)

app = FastAPI(
    title="Lume Enterprise Migration Platform API",
    description="Deterministic static analysis, rule matching, and AI explanations for OpenAI SDK 0.x -> 1.x migration.",
    version="1.0.0"
)

# CORS middleware for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SAMPLES_DIR = os.path.join(os.path.dirname(__file__), "samples")

class RawScanRequest(BaseModel):
    filename: str = "snippet.py"
    code: str

class ExplainRequest(BaseModel):
    finding: Finding
    file_context: Optional[str] = None

class FullScanResponse(BaseModel):
    report: ReportData
    files: List[ScannedFileResult]
    verification: Dict[str, Any]

def summarize_verification(files: List[ScannedFileResult]) -> Dict[str, Any]:
    verified_files = sum(1 for file in files if file.verification.valid)
    failed_files = len(files) - verified_files
    return {
        "total_files": len(files),
        "verified_files": verified_files,
        "failed_files": failed_files,
        "all_valid": failed_files == 0,
        "scope": "syntax_only",
    }

@app.get("/api/health")
def health_check():
    return {"status": "ok", "platform": "Lume", "version": "1.0.0"}

@app.get("/api/rules", response_model=List[Rule])
def get_migration_rules():
    """Returns all deterministic migration rules."""
    return list(OPENAI_MIGRATION_RULES.values())

@app.get("/api/samples")
def list_samples():
    """Returns list of pre-packaged sample repositories."""
    samples = []
    if os.path.exists(SAMPLES_DIR):
        for f in os.listdir(SAMPLES_DIR):
            if f.endswith(".py"):
                samples.append({
                    "id": f,
                    "name": f.replace("_", " ").replace(".py", "").title(),
                    "filename": f
                })
    return samples

@app.post("/api/scan/sample/{sample_id}", response_model=FullScanResponse)
def scan_sample(sample_id: str):
    """Scans one or all pre-packaged sample repositories."""
    if sample_id == "all":
        scanned_files = scan_directory(SAMPLES_DIR)
    else:
        sample_path = os.path.join(SAMPLES_DIR, sample_id)
        if not os.path.exists(sample_path):
            raise HTTPException(status_code=404, detail="Sample repository not found")
        
        with open(sample_path, "r", encoding="utf-8") as f:
            code = f.read()
            
        findings = analyze_code(sample_id, code)
        transformed_code, diff_text, _ = transform_source_code(code, findings)
        scanned_files = [
            ScannedFileResult(
                file_path=sample_id,
                original_code=code,
                transformed_code=transformed_code,
                diff_text=diff_text,
                findings=findings,
                verification=verify_transformed_code(sample_id, transformed_code),
            )
        ]

    all_findings: List[Finding] = []
    for sf in scanned_files:
        all_findings.extend(sf.findings)

    report = generate_report(len(scanned_files), all_findings)
    return FullScanResponse(
        report=report,
        files=scanned_files,
        verification=summarize_verification(scanned_files),
    )

@app.post("/api/scan/upload", response_model=FullScanResponse)
async def scan_upload(file: UploadFile = File(...)):
    """Upload ZIP archive of Python repository to analyze."""
    if not file.filename.endswith(".zip"):
        raise HTTPException(status_code=400, detail="Only .zip repository archives are supported")

    content = await file.read()
    scanned_files = scan_zip_bytes(content)
    
    all_findings: List[Finding] = []
    for sf in scanned_files:
        all_findings.extend(sf.findings)

    report = generate_report(len(scanned_files), all_findings)
    return FullScanResponse(
        report=report,
        files=scanned_files,
        verification=summarize_verification(scanned_files),
    )

@app.post("/api/scan/raw", response_model=FullScanResponse)
def scan_raw(request: RawScanRequest):
    """Scans raw Python source snippet."""
    findings = analyze_code(request.filename, request.code)
    transformed_code, diff_text, _ = transform_source_code(request.code, findings)
    scanned_files = [
        ScannedFileResult(
            file_path=request.filename,
            original_code=request.code,
            transformed_code=transformed_code,
            diff_text=diff_text,
            findings=findings,
            verification=verify_transformed_code(request.filename, transformed_code),
        )
    ]
    report = generate_report(1, findings)
    return FullScanResponse(
        report=report,
        files=scanned_files,
        verification=summarize_verification(scanned_files),
    )

@app.post("/api/explain", response_model=ExplanationResult)
def explain_finding_endpoint(request: ExplainRequest):
    """Generates AI/deterministic explanation for finding."""
    return generate_explanation(request.finding, request.file_context)

@app.post("/api/export/markdown")
def export_markdown(report: ReportData):
    """Generates downloadable Markdown report text."""
    md_content = generate_markdown_report(report)
    return {"markdown": md_content}

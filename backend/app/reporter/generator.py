"""
Migration Report Generator for Lume.
Generates structured JSON and executive Markdown reports.
"""
from typing import List, Dict, Any
from datetime import datetime
from pydantic import BaseModel
from app.analyzer.ast_engine import Finding, FindingSeverity

class MigrationSummary(BaseModel):
    total_files_scanned: int
    total_findings: int
    readiness_score: int
    critical_count: int
    high_count: int
    medium_count: int
    low_count: int
    automatic_count: int
    manual_review_count: int

class ReportData(BaseModel):
    timestamp: str
    target_migration: str = "OpenAI Python SDK 0.x -> 1.x"
    summary: MigrationSummary
    findings: List[Finding]

def calculate_readiness_score(critical: int, high: int, medium: int, low: int) -> int:
    deductions = (critical * 15) + (high * 10) + (medium * 5) + (low * 2)
    return max(0, 100 - deductions)

def generate_report(files_count: int, findings: List[Finding]) -> ReportData:
    critical = sum(1 for f in findings if f.severity == FindingSeverity.CRITICAL)
    high = sum(1 for f in findings if f.severity == FindingSeverity.HIGH)
    medium = sum(1 for f in findings if f.severity == FindingSeverity.MEDIUM)
    low = sum(1 for f in findings if f.severity == FindingSeverity.LOW)
    
    auto_count = sum(1 for f in findings if f.automation != "MANUAL_REVIEW")
    manual_count = len(findings) - auto_count
    
    score = calculate_readiness_score(critical, high, medium, low)
    
    summary = MigrationSummary(
        total_files_scanned=files_count,
        total_findings=len(findings),
        readiness_score=score,
        critical_count=critical,
        high_count=high,
        medium_count=medium,
        low_count=low,
        automatic_count=auto_count,
        manual_review_count=manual_count
    )
    
    return ReportData(
        timestamp=datetime.utcnow().isoformat() + "Z",
        summary=summary,
        findings=findings
    )

def generate_markdown_report(report: ReportData) -> str:
    s = report.summary
    md = f"""# 🚀 Lume Migration Assessment Report

**Target Migration:** {report.target_migration}  
**Scan Timestamp:** {report.timestamp}  
**Production Readiness Score:** **{s.readiness_score}%**  

---

## 📊 Assessment Executive Summary

- **Total Python Files Scanned:** {s.total_files_scanned}
- **Total Migration Findings:** {s.total_findings}
- **Safe Automatic Transformations:** {s.automatic_count}
- **Manual Engineering Reviews Required:** {s.manual_review_count}

### 🚨 Risk & Severity Distribution

| Severity | Finding Count | Impact Level |
|---|---|---|
| **CRITICAL** | {s.critical_count} | Immediate runtime break on v1.x upgrade |
| **HIGH** | {s.high_count} | API signature / Exception breaking change |
| **MEDIUM** | {s.medium_count} | Deprecated pattern or configuration |
| **LOW** | {s.low_count} | Minor utility or model list method |

---

## 🔍 Detailed Findings & Recommended Actions

"""
    for idx, f in enumerate(report.findings, 1):
        md += f"""### {idx}. [{f.severity}] {f.rule_name} (`{f.id}`)
- **File Location:** `{f.file_path}:{f.line_number}`
- **Category:** `{f.category}`
- **Automation Status:** `{f.automation}`

**Legacy Code Snippet (v0.x):**
```python
{f.code_snippet}
```

**Target Migration Snippet (v1.x):**
```python
{f.suggested_replacement}
```

**Rationale:**
{f.why_changed}

**Migration Action:**
{f.migration_advice}

---
"""
    return md

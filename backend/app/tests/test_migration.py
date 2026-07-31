"""
Unit tests for Lume Migration Platform backend.
"""
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.analyzer.ast_engine import analyze_code, FindingSeverity, FindingCategory
from app.transformer.codemod import transform_source_code
from app.reporter.generator import calculate_readiness_score, generate_report

client = TestClient(app)

SAMPLE_LEGACY_CODE = """import os
import openai

openai.api_key = "sk-test-12345"

def ask_gpt(prompt):
    try:
        res = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",
            messages=[{"role": "user", "content": prompt}]
        )
        return res.choices[0].message.content
    except openai.error.RateLimitError:
        return "Rate limited"
"""

def test_ast_engine_detection():
    findings = analyze_code("test_file.py", SAMPLE_LEGACY_CODE)
    
    rule_ids = [f.rule_id for f in findings]
    assert "RULE-IMPORT-001" in rule_ids
    assert "RULE-CONFIG-001" in rule_ids
    assert "RULE-CHAT-001" in rule_ids
    assert "RULE-EXCEPT-001" in rule_ids
    
    chat_finding = next(f for f in findings if f.rule_id == "RULE-CHAT-001")
    assert chat_finding.severity == FindingSeverity.CRITICAL
    assert chat_finding.category == FindingCategory.API_CALL

def test_codemod_transformation():
    findings = analyze_code("test_file.py", SAMPLE_LEGACY_CODE)
    transformed_code, diff_text, applied = transform_source_code(SAMPLE_LEGACY_CODE, findings)
    
    assert "from openai import OpenAI" in transformed_code
    assert "client = OpenAI(api_key=\"sk-test-12345\")" in transformed_code
    assert "client.chat.completions.create" in transformed_code
    assert "except openai.RateLimitError:" in transformed_code
    assert "diff -u" in diff_text or "---" in diff_text

def test_readiness_score():
    score_clean = calculate_readiness_score(0, 0, 0, 0)
    assert score_clean == 100
    
    score_high_risk = calculate_readiness_score(2, 3, 1, 0) # 2*15 + 3*10 + 1*5 = 65 deduction
    assert score_high_risk == 35

def test_api_endpoints():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    
    rules_resp = client.get("/api/rules")
    assert rules_resp.status_code == 200
    assert len(rules_resp.json()) > 0

    samples_resp = client.get("/api/samples")
    assert samples_resp.status_code == 200
    assert len(samples_resp.json()) >= 3

    scan_resp = client.post("/api/scan/sample/all")
    assert scan_resp.status_code == 200
    data = scan_resp.json()
    assert "report" in data
    assert "files" in data
    assert data["report"]["summary"]["total_findings"] > 0

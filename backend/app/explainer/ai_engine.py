"""
AI & Deterministic Explanation Engine.
Converts static analysis findings into explainable recommendations for developers.
"""
import os
import logging
from typing import Dict, Any, Optional
from pydantic import BaseModel
from app.analyzer.ast_engine import Finding

logger = logging.getLogger("lume.explainer")

class ExplanationResult(BaseModel):
    finding_id: str
    rule_id: str
    summary: str
    rationale: str
    breaking_change_risk: str
    migration_steps: list[str]
    ai_generated: bool

def generate_explanation(finding: Finding, file_context: Optional[str] = None) -> ExplanationResult:
    """
    Generates human-readable explanation for a specific migration finding.
    Uses Gemini API if available, falling back to deterministic explanation templates.
    """
    gemini_api_key = os.getenv("GEMINI_API_KEY")
    
    if gemini_api_key:
        try:
            # Call Gemini API if key is present
            from google import genai
            client = genai.Client(api_key=gemini_api_key)
            prompt = f"""
            You are Lume, an expert AI software migration assistant. Explain the following Python migration finding from OpenAI SDK v0.x to v1.x:

            Rule Name: {finding.rule_name}
            Category: {finding.category}
            Severity: {finding.severity}
            File Path: {finding.file_path}:{finding.line_number}
            Code Snippet: `{finding.code_snippet}`
            Suggested Replacement: `{finding.suggested_replacement}`
            Why Changed: {finding.why_changed}

            Provide a short response formatted with:
            1. Brief summary (1-2 sentences)
            2. Rationale & technical context
            3. Breaking change risk assessment
            4. Step-by-step developer migration instructions (3 bullet points max)
            """
            response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt
            )
            if response.text:
                text = response.text
                return ExplanationResult(
                    finding_id=finding.id,
                    rule_id=finding.rule_id,
                    summary=f"AI Explanation for {finding.rule_name}",
                    rationale=text,
                    breaking_change_risk=f"Severity: {finding.severity} - High impact on API runtime behavior.",
                    migration_steps=[
                        "Update import statements to use `from openai import OpenAI`.",
                        "Instantiate `client = OpenAI()` with your configuration.",
                        f"Replace call line {finding.line_number} with `{finding.suggested_replacement}`."
                    ],
                    ai_generated=True
                )
        except Exception as e:
            logger.warning(f"Gemini API call failed, falling back to deterministic engine: {e}")

    # Deterministic Fallback Engine
    return ExplanationResult(
        finding_id=finding.id,
        rule_id=finding.rule_id,
        summary=f"Migration Finding: {finding.rule_name}",
        rationale=finding.why_changed,
        breaking_change_risk=f"Risk Level: {finding.severity}. Upgrading to OpenAI v1.0+ will cause AttributeError/TypeError if left unhandled.",
        migration_steps=[
            f"Review legacy pattern at line {finding.line_number}: `{finding.code_snippet}`.",
            f"Apply replacement: `{finding.suggested_replacement}`.",
            finding.migration_advice
        ],
        ai_generated=False
    )

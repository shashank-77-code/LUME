"""
Deterministic Migration Rules Engine for OpenAI SDK v0.x -> v1.x
"""
from typing import Dict, Any, List, Optional
from enum import Enum
from pydantic import BaseModel

class FindingCategory(str, Enum):
    IMPORT = "IMPORT"
    CONFIGURATION = "CONFIGURATION"
    API_CALL = "API_CALL"
    EXCEPTION = "EXCEPTION"
    UNSUPPORTED_PATTERN = "UNSUPPORTED_PATTERN"

class FindingSeverity(str, Enum):
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"

class AutomationStatus(str, Enum):
    AUTOMATIC = "AUTOMATIC"
    PARTIAL = "PARTIAL"
    MANUAL_REVIEW = "MANUAL_REVIEW"

class Rule(BaseModel):
    id: str
    name: str
    category: FindingCategory
    severity: FindingSeverity
    automation: AutomationStatus
    description: str
    legacy_pattern: str
    target_pattern: str
    why_changed: str
    migration_advice: str

# Master Rule Registry
OPENAI_MIGRATION_RULES: Dict[str, Rule] = {
    "RULE-IMPORT-001": Rule(
        id="RULE-IMPORT-001",
        name="Legacy OpenAI Module Import",
        category=FindingCategory.IMPORT,
        severity=FindingSeverity.HIGH,
        automation=AutomationStatus.AUTOMATIC,
        description="Module import 'import openai' should be updated to instantiate explicit client class.",
        legacy_pattern="import openai",
        target_pattern="from openai import OpenAI\nclient = OpenAI()",
        why_changed="OpenAI v1.0.0 introduced explicit client instantiation (OpenAI()) instead of global module-level configuration.",
        migration_advice="Import 'OpenAI' class and instantiate 'client = OpenAI()' instead of calling global methods."
    ),
    "RULE-CONFIG-001": Rule(
        id="RULE-CONFIG-001",
        name="Global API Key Assignment",
        category=FindingCategory.CONFIGURATION,
        severity=FindingSeverity.CRITICAL,
        automation=AutomationStatus.AUTOMATIC,
        description="Setting global 'openai.api_key' is deprecated in v1.x.",
        legacy_pattern="openai.api_key = ...",
        target_pattern="client = OpenAI(api_key=...)",
        why_changed="Global API state was removed to prevent concurrency leaks in multi-threaded environment and support multi-tenant clients.",
        migration_advice="Pass 'api_key' parameter to 'OpenAI()' constructor or set OPENAI_API_KEY environment variable."
    ),
    "RULE-CONFIG-002": Rule(
        id="RULE-CONFIG-002",
        name="Global API Base / Organization Assignment",
        category=FindingCategory.CONFIGURATION,
        severity=FindingSeverity.HIGH,
        automation=AutomationStatus.AUTOMATIC,
        description="Setting global 'openai.api_base' or 'openai.organization' is deprecated.",
        legacy_pattern="openai.api_base = ... / openai.organization = ...",
        target_pattern="client = OpenAI(base_url=..., organization=...)",
        why_changed="Module-level configuration properties were consolidated into client constructor kwargs.",
        migration_advice="Use 'base_url' and 'organization' parameters when creating the OpenAI client instance."
    ),
    "RULE-CHAT-001": Rule(
        id="RULE-CHAT-001",
        name="Legacy ChatCompletion.create Call",
        category=FindingCategory.API_CALL,
        severity=FindingSeverity.CRITICAL,
        automation=AutomationStatus.AUTOMATIC,
        description="'openai.ChatCompletion.create()' has been moved to 'client.chat.completions.create()'.",
        legacy_pattern="openai.ChatCompletion.create(...)",
        target_pattern="client.chat.completions.create(...)",
        why_changed="API methods were organized under hierarchical resource namespaces (chat.completions).",
        migration_advice="Replace 'openai.ChatCompletion.create' with 'client.chat.completions.create'."
    ),
    "RULE-CHAT-002": Rule(
        id="RULE-CHAT-002",
        name="Legacy Async ChatCompletion.acreate Call",
        category=FindingCategory.API_CALL,
        severity=FindingSeverity.CRITICAL,
        automation=AutomationStatus.AUTOMATIC,
        description="'openai.ChatCompletion.acreate()' has been replaced by AsyncOpenAI client.",
        legacy_pattern="await openai.ChatCompletion.acreate(...)",
        target_pattern="await async_client.chat.completions.create(...)",
        why_changed="Async operations now require 'AsyncOpenAI()' client instance instead of '.acreate()' methods.",
        migration_advice="Use 'from openai import AsyncOpenAI' and 'await client.chat.completions.create(...)'."
    ),
    "RULE-COMP-001": Rule(
        id="RULE-COMP-001",
        name="Legacy Completion.create Call",
        category=FindingCategory.API_CALL,
        severity=FindingSeverity.HIGH,
        automation=AutomationStatus.AUTOMATIC,
        description="'openai.Completion.create()' moved to 'client.completions.create()'.",
        legacy_pattern="openai.Completion.create(...)",
        target_pattern="client.completions.create(...)",
        why_changed="Text completion API namespace reorganized under client instance.",
        migration_advice="Replace 'openai.Completion.create' with 'client.completions.create'."
    ),
    "RULE-EMBED-001": Rule(
        id="RULE-EMBED-001",
        name="Legacy Embedding.create Call",
        category=FindingCategory.API_CALL,
        severity=FindingSeverity.HIGH,
        automation=AutomationStatus.AUTOMATIC,
        description="'openai.Embedding.create()' moved to 'client.embeddings.create()'.",
        legacy_pattern="openai.Embedding.create(...)",
        target_pattern="client.embeddings.create(...)",
        why_changed="Embeddings namespace reorganized.",
        migration_advice="Replace 'openai.Embedding.create' with 'client.embeddings.create'."
    ),
    "RULE-AUDIO-001": Rule(
        id="RULE-AUDIO-001",
        name="Legacy Audio.transcribe Call",
        category=FindingCategory.API_CALL,
        severity=FindingSeverity.HIGH,
        automation=AutomationStatus.AUTOMATIC,
        description="'openai.Audio.transcribe()' moved to 'client.audio.transcriptions.create()'.",
        legacy_pattern="openai.Audio.transcribe(...)",
        target_pattern="client.audio.transcriptions.create(...)",
        why_changed="Audio transcription API endpoints aligned with REST schema.",
        migration_advice="Replace 'openai.Audio.transcribe' with 'client.audio.transcriptions.create'."
    ),
    "RULE-AUDIO-002": Rule(
        id="RULE-AUDIO-002",
        name="Legacy Audio.translate Call",
        category=FindingCategory.API_CALL,
        severity=FindingSeverity.HIGH,
        automation=AutomationStatus.AUTOMATIC,
        description="'openai.Audio.translate()' moved to 'client.audio.translations.create()'.",
        legacy_pattern="openai.Audio.translate(...)",
        target_pattern="client.audio.translations.create(...)",
        why_changed="Audio translation API endpoints aligned with REST schema.",
        migration_advice="Replace 'openai.Audio.translate' with 'client.audio.translations.create'."
    ),
    "RULE-IMAGE-001": Rule(
        id="RULE-IMAGE-001",
        name="Legacy Image.create Call",
        category=FindingCategory.API_CALL,
        severity=FindingSeverity.MEDIUM,
        automation=AutomationStatus.AUTOMATIC,
        description="Legacy image create, variation, and edit calls moved to explicit image resource methods.",
        legacy_pattern="openai.Image.create(...) / create_variation(...) / create_edit(...)",
        target_pattern="client.images.generate(...) / create_variation(...) / edit(...)",
        why_changed="Image creation renamed to '.generate()' for clarity.",
        migration_advice="Replace create with generate, create_variation with create_variation, and create_edit with edit."
    ),
    "RULE-MODEL-001": Rule(
        id="RULE-MODEL-001",
        name="Legacy Model.list / Model.retrieve Call",
        category=FindingCategory.API_CALL,
        severity=FindingSeverity.LOW,
        automation=AutomationStatus.AUTOMATIC,
        description="Legacy model list and retrieve calls moved to the explicit models resource.",
        legacy_pattern="openai.Model.list() / openai.Model.retrieve()",
        target_pattern="client.models.list() / client.models.retrieve()",
        why_changed="Models management namespace updated.",
        migration_advice="Replace Model.list with client.models.list and Model.retrieve with client.models.retrieve."
    ),
    "RULE-EXCEPT-001": Rule(
        id="RULE-EXCEPT-001",
        name="Legacy Error Submodule Handling",
        category=FindingCategory.EXCEPTION,
        severity=FindingSeverity.HIGH,
        automation=AutomationStatus.AUTOMATIC,
        description="'openai.error.*' exceptions moved to root 'openai.*' error hierarchy.",
        legacy_pattern="openai.error.OpenAIError / RateLimitError / InvalidRequestError",
        target_pattern="openai.APIError / RateLimitError / BadRequestError",
        why_changed="The 'openai.error' submodule was dropped. All exception types are imported directly from top-level 'openai' module with updated names.",
        migration_advice="Update exception imports/references: InvalidRequestError -> BadRequestError, ServiceUnavailableError -> APIConnectionError, error.OpenAIError -> APIError."
    ),
    "RULE-UNSUPPORTED-001": Rule(
        id="RULE-UNSUPPORTED-001",
        name="Dynamic or Wrapped API Access",
        category=FindingCategory.UNSUPPORTED_PATTERN,
        severity=FindingSeverity.HIGH,
        automation=AutomationStatus.MANUAL_REVIEW,
        description="Dynamic invocation via getattr(openai, ...) or custom wrapper functions requires manual review.",
        legacy_pattern="getattr(openai, call_name) / dynamic proxy",
        target_pattern="Explicit client usage",
        why_changed="Static analysis cannot safely automate dynamic reflection calls without risking runtime errors.",
        migration_advice="Manually inspect dynamic call site and replace with explicit client call."
    )
}

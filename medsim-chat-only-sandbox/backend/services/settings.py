from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


def normalize_base_url(url: str) -> str:
    normalized = (url or "").strip().rstrip("/")
    if normalized.endswith("/v1"):
        normalized = normalized[: -len("/v1")]
    return normalized


def normalize_openai_base_url(url: str) -> str:
    normalized = (url or "").strip().rstrip("/")
    if not normalized:
        return ""
    lower = normalized.lower()

    # If the user pasted an endpoint under /v1 (e.g. .../v1/tts or .../v1/audio/speech),
    # truncate to the base OpenAI-compatible root.
    idx = lower.find("/v1beta/openai")
    if idx != -1:
        return normalized[: idx + len("/v1beta/openai")]
    idx = lower.find("/v1")
    if idx != -1:
        return normalized[: idx + len("/v1")]

    return f"{normalized}/v1"


@dataclass
class AppSettings:
    patients_dir: Path
    students_dir: Path
    evaluations_dir: Path
    encounters_dir: Path
    audio_dir: Path

    patient_llm_url: str
    patient_llm_api_key: str
    patient_llm_model: str
    ollama_url: str

    stt_api_url: str
    stt_api_key: str
    stt_model: str

    tts_api_url: str
    tts_api_key: str
    tts_voice_id: str
    tts_model_id: str
    tts_language: str


def load_settings() -> AppSettings:
    # backend/services/settings.py -> project root is two levels up.
    base_dir = Path(__file__).resolve().parents[2]
    return AppSettings(
        patients_dir=Path(os.getenv("PATIENTS_DIR", str(base_dir / "patients"))),
        students_dir=Path(os.getenv("STUDENTS_DIR", str(base_dir / "students"))),
        evaluations_dir=Path(os.getenv("EVALUATIONS_DIR", str(base_dir / "evaluations"))),
        encounters_dir=Path(os.getenv("ENCOUNTERS_DIR", str(base_dir / "encounters"))),
        audio_dir=Path(os.getenv("AUDIO_DIR", str(base_dir / "audio"))),

        patient_llm_url=os.getenv("PATIENT_LLM_URL", "").strip(),
        patient_llm_api_key=os.getenv("PATIENT_LLM_API_KEY", "").strip(),
        patient_llm_model=os.getenv("PATIENT_LLM_MODEL", "").strip(),
        ollama_url=os.getenv("OLLAMA_URL", "http://host.docker.internal:11434").strip(),

        stt_api_url=os.getenv("STT_API_URL", "").strip(),
        stt_api_key=os.getenv("STT_API_KEY", "").strip(),
        stt_model=os.getenv("STT_MODEL", os.getenv("GEMINI_MODEL", "gemini-2.0-flash")).strip(),

        tts_api_url=os.getenv("TTS_API_URL", "").strip(),
        tts_api_key=os.getenv("TTS_API_KEY", os.getenv("ELEVENLABS_API_KEY", "")).strip(),
        tts_voice_id=os.getenv("TTS_VOICE_ID", os.getenv("ELEVENLABS_VOICE_ID", "")).strip(),
        tts_model_id=os.getenv("TTS_MODEL_ID", os.getenv("ELEVENLABS_MODEL_ID", "eleven_multilingual_v2")).strip(),
        tts_language=os.getenv("TTS_LANGUAGE", os.getenv("TTS_LANG", "es-AR")).strip(),
    )

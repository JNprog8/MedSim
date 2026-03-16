from __future__ import annotations

from pathlib import Path
from typing import Optional

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class AppSettings(BaseSettings):
    """Configuración centralizada de la aplicación MedSim."""
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    # --- Constantes del Servidor ---
    SERVER_SCHEMA_VERSION: int = 3
    LOG_LEVEL: str = "INFO"

    # --- Directorios y Paths ---
    BASE_DIR: Path = Path(__file__).resolve().parent.parent
    PATIENTS_DIR: Path = Field(default_factory=lambda: Path(__file__).resolve().parent.parent / "patients")
    DB_PATH: Path = Field(default_factory=lambda: Path(__file__).resolve().parent.parent / "medsim.db")

    # --- LLM Backend ---
    PATIENT_LLM_URL: str = ""
    PATIENT_LLM_API_KEY: str = ""
    PATIENT_LLM_MODEL: str = ""
    OLLAMA_URL: str = "http://host.docker.internal:11434"

    # --- STT (Speech-to-Text) ---
    STT_API_URL: str = ""
    STT_API_KEY: str = ""
    STT_MODEL: str = "gemini-2.0-flash"

    # --- TTS (Text-to-Speech) ---
    TTS_API_URL: str = ""
    TTS_API_KEY: str = ""
    TTS_VOICE_ID: str = ""
    TTS_MODEL_ID: str = "eleven_multilingual_v2"
    TTS_LANGUAGE: str = "es"


def load_settings() -> AppSettings:
    """Carga y valida los settings."""
    return AppSettings()

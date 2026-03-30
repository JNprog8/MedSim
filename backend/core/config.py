from pathlib import Path
from typing import Optional

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # --- PROYECTO ---
    PROJECT_NAME: str = "MedSim"
    DEBUG: bool = False
    PORT: int = 8000
    BASE_DIR: Path = Path(__file__).resolve().parent.parent.parent

    # --- MONGO DB ---
    MONGO_URL: str = "mongodb://localhost:27017/medsim"
    MONGO_DB_NAME: str = "medsim"
    # --- LLM CONFIG ---
    PATIENT_LLM_URL: Optional[str] = None
    PATIENT_LLM_API_KEY: Optional[str] = None
    PATIENT_LLM_MODEL: str = "gpt-4-turbo"
    OLLAMA_URL: str = "http://localhost:11434"

    # --- STT CONFIG ---
    STT_API_URL: Optional[str] = None
    STT_API_KEY: Optional[str] = None
    STT_MODEL: str = "whisper-1"

    # --- TTS CONFIG ---
    TTS_API_URL: Optional[str] = None
    TTS_API_KEY: Optional[str] = None
    TTS_VOICE_ID: Optional[str] = None
    TTS_MODEL_ID: Optional[str] = None
    TTS_LANGUAGE: str = "es"
    TTS_SPEED: float = 1.0
    TTS_TEMPERATURE: float = 0.5

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @field_validator("DEBUG", mode="before")
    @classmethod
    def parse_debug_flag(cls, value):
        if isinstance(value, bool) or value is None:
            return value

        if isinstance(value, str):
            normalized = value.strip().lower()
            truthy_values = {"1", "true", "yes", "on", "debug", "development", "dev"}
            falsy_values = {"0", "false", "no", "off", "release", "prod", "production"}

            if normalized in truthy_values:
                return True
            if normalized in falsy_values:
                return False

        return value

settings = Settings()

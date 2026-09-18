from pathlib import Path
from typing import Literal, Optional

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # --- PROYECTO ---
    PROJECT_NAME: str = "MedSim"
    DEBUG: bool = False
    HOST: str = "0.0.0.0"
    PORT: int = Field(default=8000, ge=1, le=65535)
    BOOTSTRAP_DEMO: bool = False
    LOG_LEVEL: Literal["critical", "error", "warning", "info", "debug", "trace"] = "info"
    ACCESS_LOG: bool = True
    PROXY_HEADERS: bool = False
    FORWARDED_ALLOW_IPS: str = "127.0.0.1"
    GRACEFUL_TIMEOUT_SECONDS: int = Field(default=30, ge=1)
    BASE_DIR: Path = Path(__file__).resolve().parent.parent.parent
    # Autenticación de sitio. Vacío = sin login.
    SITE_PASSWORD: Optional[str] = None
    SECRET_KEY: str = "change-me-in-production-use-a-long-random-string"
    SECURE_COOKIES: Optional[bool] = None

    # --- MONGO DB ---
    # Usamos 127.0.0.1 para comunicación interna en el Pod
    MONGO_URL: str = "mongodb://127.0.0.1:27017/medsim"
    MONGO_DB_NAME: str = "medsim"
    MONGO_USER: Optional[str] = None
    MONGO_PASSWORD: Optional[str] = None
    
    # --- LLM CONFIG ---
    PATIENT_LLM_URL: Optional[str] = None
    PATIENT_LLM_API_KEY: Optional[str] = None
    PATIENT_LLM_MODEL: str = "gpt-4-turbo"
    OLLAMA_URL: str = "http://host.containers.internal:11434"

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

    model_config = SettingsConfigDict(
        env_file=str(Path(__file__).resolve().parent.parent.parent / ".env"),
        env_file_encoding='utf-8',
        extra="ignore"
    )

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

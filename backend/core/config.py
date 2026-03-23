import os
from pathlib import Path
from typing import Optional

from pydantic import Field
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

    # --- DIRECTORIOS DE DATOS ---
    PATIENTS_DIR: Path = Field(default_factory=lambda: Path("patients"))
    STUDENTS_DIR: Path = Field(default_factory=lambda: Path("students"))
    EVALUATIONS_DIR: Path = Field(default_factory=lambda: Path("evaluations"))
    ENCOUNTERS_DIR: Path = Field(default_factory=lambda: Path("encounters"))
    AUDIO_DIR: Path = Field(default_factory=lambda: Path("audio"))

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

    @property
    def patients_path(self) -> Path:
        p = Path(os.environ.get("PATIENTS_DIR", self.BASE_DIR / "patients"))
        if not p.is_absolute():
            p = self.BASE_DIR / p
        p.mkdir(parents=True, exist_ok=True)
        return p

    @property
    def students_path(self) -> Path:
        p = Path(os.environ.get("STUDENTS_DIR", self.BASE_DIR / "students"))
        if not p.is_absolute():
            p = self.BASE_DIR / p
        p.mkdir(parents=True, exist_ok=True)
        return p

    @property
    def audio_path(self) -> Path:
        p = Path(os.environ.get("AUDIO_DIR", self.BASE_DIR / "audio"))
        if not p.is_absolute():
            p = self.BASE_DIR / p
        p.mkdir(parents=True, exist_ok=True)
        return p


settings = Settings()

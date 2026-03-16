from __future__ import annotations

from services.audio_turn_service import AudioTurnService
from services.database_service import DatabaseService
from services.encounter_service import EncounterService
from services.llm_service import LLMService
from services.patient_service import PatientService
from services.prompt_service import PromptService
from services.settings import load_settings
from services.stt_service import STTService
from services.tts_service import TTSService


class ServiceContainer:
    def __init__(self):
        self.settings = load_settings()
        self.database_service = DatabaseService(self.settings.db_path)
        self.patient_service = PatientService(self.settings.patients_dir)
        self.prompt_service = PromptService()
        self.encounter_service = EncounterService(self.patient_service, self.prompt_service, self.database_service)
        self.llm_service = LLMService(self.settings)
        self.stt_service = STTService(
            api_url=self.settings.stt_api_url,
            api_key=self.settings.stt_api_key,
            model=self.settings.stt_model,
        )
        self.tts_service = TTSService(
            api_url=self.settings.tts_api_url,
            api_key=self.settings.tts_api_key,
            voice_id=self.settings.tts_voice_id,
            model_id=self.settings.tts_model_id,
            language=self.settings.tts_language,
            speed=None,
            temperature=None,
        )
        self.audio_turn_service = AudioTurnService(
            self.patient_service,
            self.prompt_service,
            self.encounter_service,
            self.llm_service,
            self.stt_service,
            self.tts_service,
        )


services = ServiceContainer()

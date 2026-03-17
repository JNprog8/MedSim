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
        self.database_service = DatabaseService(self.settings.DB_PATH)
        self.patient_service = PatientService(self.settings.PATIENTS_DIR)
        self.prompt_service = PromptService()
        self.encounter_service = EncounterService(self.patient_service, self.prompt_service, self.database_service)
        self.llm_service = LLMService(self.settings)
        self.stt_service = STTService(
            api_url=self.settings.STT_API_URL,
            api_key=self.settings.STT_API_KEY,
            model=self.settings.STT_MODEL,
        )
        self.tts_service = TTSService(
            api_url=self.settings.TTS_API_URL,
            api_key=self.settings.TTS_API_KEY,
            voice_id=self.settings.TTS_VOICE_ID,
            model_id=self.settings.TTS_MODEL_ID,
            language=self.settings.TTS_LANGUAGE,
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

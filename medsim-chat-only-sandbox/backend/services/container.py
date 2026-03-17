from __future__ import annotations

from .audio_turn_service import AudioTurnService
from .encounter_service import EncounterService
from .evaluation_service import EvaluationService
from .llm_service import LLMService
from .patient_service import PatientService
from .prompt_service import PromptService
from .realtime.hub import get_realtime_hub
from .settings import load_settings
from .student_service import StudentService
from .stt_service import STTService
from .tts_service import TTSService


class ServiceContainer:
    def __init__(self):
        self.settings = load_settings()

        self.realtime_hub = get_realtime_hub()

        self.patient_service = PatientService(self.settings.patients_dir)
        self.student_service = StudentService(self.settings.students_dir)
        self.evaluation_service = EvaluationService(self.settings.evaluations_dir)

        self.prompt_service = PromptService()
        self.encounter_service = EncounterService(
            self.patient_service,
            self.prompt_service,
            settings=self.settings,
            realtime_hub=self.realtime_hub,
        )

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

from backend.persistence.patient_repository import PatientRepository
from backend.persistence.student_repository import StudentRepository
from backend.persistence.encounter_repository import EncounterRepository
from backend.persistence.evaluation_repository import EvaluationRepository

from backend.services.patient_service import PatientService
from backend.services.student_service import StudentService
from backend.services.encounter_service import EncounterService
from backend.services.evaluation_service import EvaluationService
from backend.services.llm_service import LLMService
from backend.services.stt_service import STTService
from backend.services.tts_service import TTSService
from backend.services.prompt_service import PromptService
from backend.services.audio_orchestrator import AudioOrchestrator
from backend.services.realtime.hub import get_realtime_hub

class ServiceContainer:
    def __init__(self):
        # Repositories
        self.patient_repo = PatientRepository()
        self.student_repo = StudentRepository()
        self.encounter_repo = EncounterRepository()
        self.evaluation_repo = EvaluationRepository()

        # Core Services
        self.patient_service = PatientService(self.patient_repo)
        self.student_service = StudentService(self.student_repo)
        self.encounter_service = EncounterService(self.encounter_repo)
        self.evaluation_service = EvaluationService(self.evaluation_repo)
        
        self.llm_service = LLMService()
        self.stt_service = STTService()
        self.tts_service = TTSService()
        self.prompt_service = PromptService()
        self.realtime_hub = get_realtime_hub()

        # Orchestrator
        self.audio_orchestrator = AudioOrchestrator(
            self.patient_service,
            self.encounter_service,
            self.llm_service,
            self.stt_service,
            self.tts_service,
            self.prompt_service,
            self.realtime_hub
        )

# Global singleton
services = ServiceContainer()

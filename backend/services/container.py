from typing import Optional
from motor.motor_asyncio import AsyncIOMotorDatabase

from backend.persistence.patient_repository import PatientRepository
from backend.persistence.student_repository import StudentRepository
from backend.persistence.encounter_repository import EncounterRepository
from backend.persistence.evaluation_repository import EvaluationRepository
from backend.persistence.audio_repository import AudioRepository

from backend.services.patient_service import PatientService
from backend.services.student_service import StudentService
from backend.services.encounter_service import EncounterService
from backend.services.evaluation_service import EvaluationService
from backend.services.audio_service import AudioService
from backend.services.llm_service import LLMService
from backend.services.stt_service import STTService
from backend.services.tts_service import TTSService
from backend.services.prompt_service import PromptService
from backend.services.evaluation_pdf_service import EvaluationPdfService
from backend.services.audio_orchestrator import AudioOrchestrator
from backend.services.hub import get_realtime_hub

from backend.services.segue_strategy import SegueEvaluationStrategy
from backend.services.auto_evaluation_service import AutoEvaluationService

from backend.services.unreal_handler import UnrealAudioHandler
from backend.core.config import settings

class ServiceContainer:
    """
    Spec Definition: Contenedor de Inyección de Dependencias.
    Sigue el patrón Registry para centralizar la instanciación.
    """
    
    def __init__(self):
        self.unreal_handler: Optional[UnrealAudioHandler] = None
        self.auto_evaluation_service: Optional[AutoEvaluationService] = None
        self.segue_strategy = SegueEvaluationStrategy()

        self.patient_repo: Optional[PatientRepository] = None
        self.student_repo: Optional[StudentRepository] = None
        self.encounter_repo: Optional[EncounterRepository] = None
        self.evaluation_repo: Optional[EvaluationRepository] = None
        self.audio_repo: Optional[AudioRepository] = None

        self.patient_service: Optional[PatientService] = None
        self.student_service: Optional[StudentService] = None
        self.encounter_service: Optional[EncounterService] = None
        self.audio_service: Optional[AudioService] = None
        self.evaluation_pdf_service: Optional[EvaluationPdfService] = None
        
        self.llm_service: Optional[LLMService] = None
        self.stt_service: Optional[STTService] = None
        self.tts_service: Optional[TTSService] = None
        self.prompt_service: Optional[PromptService] = None
        self.realtime_hub = get_realtime_hub()
        self.evaluation_service: Optional[EvaluationService] = None
        self.audio_orchestrator: Optional[AudioOrchestrator] = None

    def wire(self, db: AsyncIOMotorDatabase) -> None:
        """
        Implementation: Vincula las dependencias inyectando la base de datos.
        """
        self.patient_repo = PatientRepository(db)
        self.student_repo = StudentRepository(db)
        self.encounter_repo = EncounterRepository(db)
        self.evaluation_repo = EvaluationRepository(db)
        self.audio_repo = AudioRepository(db)

        self.patient_service = PatientService(self.patient_repo)
        self.student_service = StudentService(self.student_repo)
        self.encounter_service = EncounterService(self.encounter_repo)
        self.audio_service = AudioService(self.audio_repo)
        self.evaluation_pdf_service = EvaluationPdfService()
        
        self.llm_service = LLMService()
        self.auto_evaluation_service = AutoEvaluationService(self.llm_service)
        self.stt_service = STTService()
        self.tts_service = TTSService()
        self.prompt_service = PromptService()
        
        self.evaluation_service = EvaluationService(
            self.evaluation_repo,
            self.encounter_service,
            self.patient_service,
            self.student_service,
            self.evaluation_pdf_service,
            self.auto_evaluation_service,
            self.segue_strategy
        )
        
        self.audio_orchestrator = AudioOrchestrator(
            self.patient_service,
            self.encounter_service,
            self.audio_service,
            self.llm_service,
            self.stt_service,
            self.tts_service,
            self.prompt_service,
            self.realtime_hub
        )

        # Injecting dependencies into UnrealAudioHandler to avoid Circular Imports
        self.unreal_handler = UnrealAudioHandler(
            settings.BASE_DIR, 
            self.encounter_service, 
            self.audio_orchestrator
        )

services = ServiceContainer()

import time
import logging
from typing import Optional, Dict, Any, List

from backend.domain.models import SegueEvaluation, SegueEvaluationItem
from backend.persistence.evaluation_repository import EvaluationRepository
from backend.domain.segue_catalog import SEGUE_ITEMS, SEGUE_SECTIONS
from backend.services.encounter_service import EncounterService
from backend.services.patient_service import PatientService
from backend.services.student_service import StudentService
from backend.services.evaluation_pdf_service import EvaluationPdfService
from backend.services.evaluation_interfaces import IAutoEvaluationService
from backend.services.segue_strategy import SegueEvaluationStrategy

logger = logging.getLogger(__name__)

class EvaluationService:
    """
    Implementation: Servicio de gestión de evaluaciones.
    Orquesta la persistencia, hidratación de datos y generación de autoevaluación IA.
    """
    
    def __init__(
        self,
        repository: EvaluationRepository,
        encounter_service: EncounterService,
        patient_service: PatientService,
        student_service: StudentService,
        pdf_service: EvaluationPdfService,
        auto_evaluation_service: IAutoEvaluationService,
        segue_strategy: SegueEvaluationStrategy
    ):
        self.__repository = repository
        self.__encounter_service = encounter_service
        self.__patient_service = patient_service
        self.__student_service = student_service
        self.__pdf_service = pdf_service
        self.__auto_evaluation_service = auto_evaluation_service
        self.__segue_strategy = segue_strategy

    async def get_auto_feedback(self, encounter_id: str) -> Dict[str, Any]:
        """
        Tell: Genera feedback automático para el estudiante.
        """
        encounter = await self.__encounter_service.get_encounter(encounter_id)
        if not encounter:
            return {"error": "Encuentro no encontrado"}
        
        # Delegar al servicio especializado inyectado (DIP)
        return await self.__auto_evaluation_service.generate_feedback(
            encounter, 
            self.__segue_strategy
        )

    async def get_evaluation_by_encounter(self, encounter_id: str) -> Optional[SegueEvaluation]:
        try:
            return await self.__repository.get_by_encounter_id(encounter_id)
        except Exception:
            return None

    async def create_or_update_evaluation(self, evaluation: SegueEvaluation) -> str:
        evaluation = await self.hydrate_evaluation(evaluation)
        evaluation.updated_at = time.time()
        return await self.__repository.upsert(evaluation)

    async def hydrate_evaluation(self, evaluation: SegueEvaluation) -> SegueEvaluation:
        """
        Completa datos faltantes de la evaluación desde el contexto del encuentro.
        """
        encounter = await self.__encounter_service.get_encounter(evaluation.encounter_id)
        if encounter:
            evaluation.patient_id = evaluation.patient_id or encounter.patient_id
            evaluation.student_id = evaluation.student_id or encounter.student_id or ""
            evaluation.evaluator_name = evaluation.evaluator_name or encounter.evaluator_name or ""

        if evaluation.student_id:
            try:
                student = await self.__student_service.get_student_id(evaluation.student_id)
                if student:
                    evaluation.student_name = evaluation.student_name or student.name
                    evaluation.student_identifier = evaluation.student_identifier or student.student_identifier
            except Exception as e:
                logger.warning(f"No se pudo hidratar el estudiante {evaluation.student_id}: {e}")

        evaluation.items = self.__normalized_items(evaluation)
        return evaluation

    def __normalized_items(self, evaluation: SegueEvaluation) -> List[SegueEvaluationItem]:
        """Garantiza que todos los ítems del catálogo existan en la evaluación."""
        existing = {str(item.id): item for item in evaluation.items}
        return [
            SegueEvaluationItem(
                id=str(cat["id"]),
                value=str(existing.get(str(cat["id"])).value if str(cat["id"]) in existing else "nc").lower(),
                notes=str(existing.get(str(cat["id"])).notes if str(cat["id"]) in existing else ""),
            )
            for cat in SEGUE_ITEMS
        ]

    async def build_view_model(self, encounter_id: str) -> Dict[str, Any]:
        """
        Builds a complete view model for the evaluator dashboard.
        """
        logger.info(f"Building view model for encounter {encounter_id}")
        encounter = await self.__encounter_service.get_encounter(encounter_id)
        if not encounter:
            logger.error(f"Encounter {encounter_id} not found in build_view_model")
            raise ValueError(f"Encounter {encounter_id} not found")

        evaluation = await self.get_evaluation_by_encounter(encounter_id)
        if not evaluation:
            logger.info(f"Evaluation not found for encounter {encounter_id}, creating a new one")
            evaluation = SegueEvaluation(
                encounter_id=encounter_id, 
                patient_id=encounter.patient_id,
                student_id=encounter.student_id or "",
                student_name="",
                evaluator_name=encounter.evaluator_name or "",
                items=[]
            )
            evaluation = await self.hydrate_evaluation(evaluation)

        try:
            patient = await self.__patient_service.get_patient_by_id(encounter.patient_id)
        except Exception as e:
            logger.warning(f"Patient {encounter.patient_id} not found for encounter {encounter_id}: {e}")
            patient = None

        student = None
        if encounter.student_id:
            try:
                student = await self.__student_service.get_student_id(encounter.student_id)
            except Exception as e:
                logger.warning(f"Student {encounter.student_id} not found for encounter {encounter_id}: {e}")

        return {
            "encounter": encounter.model_dump(),
            "evaluation": evaluation.model_dump(),
            "patient": patient.model_dump() if patient else None,
            "student": student.model_dump() if student else None,
            "segue_catalog": {
                "sections": SEGUE_SECTIONS,
                "items": SEGUE_ITEMS
            }
        }

    async def build_pdf_bytes(self, encounter_id: str) -> bytes:
        """
        Generates PDF bytes for a given encounter evaluation.
        """
        logger.info(f"Building PDF for encounter {encounter_id}")
        encounter = await self.__encounter_service.get_encounter(encounter_id)
        if not encounter:
            logger.error(f"Encounter {encounter_id} not found in build_pdf_bytes")
            raise ValueError(f"Encounter {encounter_id} not found")

        evaluation = await self.get_evaluation_by_encounter(encounter_id)
        if not evaluation:
            logger.error(f"Evaluation for encounter {encounter_id} not found in build_pdf_bytes")
            raise ValueError(f"Evaluation for encounter {encounter_id} not found")

        try:
            patient = await self.__patient_service.get_patient_by_id(encounter.patient_id)
        except Exception:
            patient = None

        student = None
        if encounter.student_id:
            try:
                student = await self.__student_service.get_student_id(encounter.student_id)
            except Exception:
                pass

        return self.__pdf_service.build_pdf(evaluation, encounter, patient, student)

    async def delete_evaluation(self, evaluation_id: str) -> bool:
        """Deletes an evaluation by its ID."""
        return await self.__repository.delete(evaluation_id)


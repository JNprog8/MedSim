import time
from typing import Optional
from backend.domain.models import SegueEvaluation, SegueEvaluationItem
from backend.persistence.evaluation_repository import EvaluationRepository
from backend.domain.segue_catalog import SEGUE_ITEMS, SEGUE_SECTIONS
from backend.services.encounter_service import EncounterService
from backend.services.patient_service import PatientService
from backend.services.student_service import StudentService
from backend.services.evaluation_pdf_service import EvaluationPdfService

class EvaluationService:
    def __init__(
        self,
        repository: EvaluationRepository,
        encounter_service: EncounterService,
        patient_service: PatientService,
        student_service: StudentService,
        pdf_service: EvaluationPdfService,
    ):
        self.repository = repository
        self.encounter_service = encounter_service
        self.patient_service = patient_service
        self.student_service = student_service
        self.pdf_service = pdf_service

    async def get_evaluation_by_encounter(self, encounter_id: str) -> Optional[SegueEvaluation]:
        return await self.repository.get_by_encounter_id(encounter_id)

    async def create_or_update_evaluation(self, evaluation: SegueEvaluation) -> str:
        evaluation = await self.hydrate_evaluation(evaluation)
        evaluation.updated_at = time.time()
        return await self.repository.upsert(evaluation)

    async def delete_evaluation(self, id: str) -> bool:
        return await self.repository.delete(id)

    async def hydrate_evaluation(self, evaluation: SegueEvaluation) -> SegueEvaluation:
        encounter = await self.encounter_service.get_encounter(evaluation.encounter_id)
        if encounter:
            if not evaluation.patient_id:
                evaluation.patient_id = encounter.patient_id
            if not evaluation.student_id:
                evaluation.student_id = encounter.student_id or ""
            if not evaluation.evaluator_name:
                evaluation.evaluator_name = encounter.evaluator_name or ""

        if evaluation.student_id:
            student = await self.student_service.get_student_id(evaluation.student_id)
            if student:
                if not evaluation.student_name:
                    evaluation.student_name = student.name
                if not evaluation.student_identifier:
                    evaluation.student_identifier = student.student_identifier

        evaluation.items = self._normalized_items(evaluation)
        evaluation = SegueEvaluation(**evaluation.model_dump())

        return evaluation

    async def build_pdf_bytes(self, encounter_id: str) -> bytes:
        evaluation = await self.get_evaluation_by_encounter(encounter_id)
        if not evaluation:
            encounter = await self.encounter_service.get_encounter(encounter_id)
            if not encounter:
                raise ValueError("Evaluation not found")
            evaluation = await self.hydrate_evaluation(
                SegueEvaluation(
                    encounter_id=encounter_id,
                    patient_id=encounter.patient_id,
                    student_id=encounter.student_id or "",
                    student_name="",
                    student_identifier="",
                    evaluator_name=encounter.evaluator_name or "",
                    items=[],
                )
            )
            await self.repository.upsert(evaluation)

        encounter = await self.encounter_service.get_encounter(encounter_id)
        patient = await self.patient_service.get_patient_by_id(evaluation.patient_id) if evaluation.patient_id else None
        student = await self.student_service.get_student_id(evaluation.student_id) if evaluation.student_id else None
        return self.pdf_service.build_pdf(evaluation, encounter=encounter, patient=patient, student=student)

    async def build_view_model(self, encounter_id: str) -> dict:
        encounter = await self.encounter_service.get_encounter(encounter_id)
        if not encounter:
            raise ValueError("Encounter not found")

        evaluation = await self.get_evaluation_by_encounter(encounter_id)
        if not evaluation:
            evaluation = await self.hydrate_evaluation(
                SegueEvaluation(
                    encounter_id=encounter_id,
                    patient_id=encounter.patient_id,
                    student_id=encounter.student_id or "",
                    student_name="",
                    student_identifier="",
                    evaluator_name=encounter.evaluator_name or "",
                    items=[],
                )
            )

        patient = await self.patient_service.get_patient_by_id(encounter.patient_id) if encounter.patient_id else None
        student = await self.student_service.get_student_id(encounter.student_id) if encounter.student_id else None

        return {
            "encounter_id": encounter_id,
            "patient_id": encounter.patient_id,
            "patient_name": patient.name if patient else "",
            "student_id": encounter.student_id or "",
            "student_name": evaluation.student_name or (student.name if student else ""),
            "student_identifier": evaluation.student_identifier or (student.student_identifier if student else ""),
            "evaluator_name": evaluation.evaluator_name or encounter.evaluator_name or "",
            "criteria": [
                {
                    "id": item["id"],
                    "label": item["label"],
                    "area": next(
                        (section["area"] for section in SEGUE_SECTIONS if any(section_item["id"] == item["id"] for section_item in section["items"])),
                        "",
                    ),
                }
                for item in SEGUE_ITEMS
            ],
            "sections": SEGUE_SECTIONS,
            "evaluation": evaluation.model_dump(),
        }

    @staticmethod
    def _normalized_items(evaluation: SegueEvaluation):
        existing = {str(item.id): item for item in evaluation.items}
        normalized = []
        for catalog_item in SEGUE_ITEMS:
            saved = existing.get(str(catalog_item["id"]))
            normalized.append(
                SegueEvaluationItem(
                    id=str(catalog_item["id"]),
                    value=str(saved.value if saved else "nc").lower(),
                    notes=str(saved.notes if saved else ""),
                )
            )
        return normalized

from typing import List, Optional
from backend.domain.models import SegueEvaluation
from backend.persistence.evaluation_repository import EvaluationRepository

class EvaluationService:
    def __init__(self, repository: EvaluationRepository):
        self.repository = repository

    async def get_evaluation_by_encounter(self, encounter_id: str) -> Optional[SegueEvaluation]:
        return await self.repository.get_by_encounter_id(encounter_id)

    async def create_or_update_evaluation(self, evaluation: SegueEvaluation) -> str:
        return await self.repository.upsert(evaluation)

    async def delete_evaluation(self, id: str) -> bool:
        return await self.repository.delete(id)

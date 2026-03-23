from typing import Optional
from backend.domain.models import SegueEvaluation
from .base_repository import BaseRepository

class EvaluationRepository(BaseRepository[SegueEvaluation]):
    def __init__(self):
        super().__init__("evaluations", SegueEvaluation)

    async def get_by_encounter_id(self, encounter_id: str) -> Optional[SegueEvaluation]:
        doc = await self.collection.find_one({"encounter_id": encounter_id})
        if doc:
            return self.model_type(**doc)
        return None

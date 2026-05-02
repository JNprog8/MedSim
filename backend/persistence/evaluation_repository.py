from typing import Optional
from motor.motor_asyncio import AsyncIOMotorDatabase
from backend.domain.models import SegueEvaluation
from .base_repository import BaseMongoRepository

class EvaluationRepository(BaseMongoRepository[SegueEvaluation]):
    def __init__(self, db: AsyncIOMotorDatabase):
        super().__init__(db, "evaluations", SegueEvaluation)

    async def get_by_encounter_id(self, encounter_id: str) -> Optional[SegueEvaluation]:
        try:
            doc = await self._collection.find_one({"encounter_id": encounter_id})
            if doc:
                return self._map_mongo_doc(doc)
            return None
        except Exception:
            return None

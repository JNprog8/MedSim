from typing import Optional
from motor.motor_asyncio import AsyncIOMotorDatabase
from backend.domain.models import Encounter, Message
from .base_repository import BaseMongoRepository

class EncounterRepository(BaseMongoRepository[Encounter]):
    def __init__(self, db: AsyncIOMotorDatabase):
        super().__init__(db, "encounters", Encounter)

    async def get_by_encounter_id(self, encounter_id: str) -> Optional[Encounter]:
        try:
            return await self.get_by_id(encounter_id, id_field="encounter_id")
        except Exception:
            return None

    async def add_message(self, encounter_id: str, message: Message):
        await self._collection.update_one(
            {"encounter_id": encounter_id},
            {"$push": {"chat_history": message.model_dump()}}
        )

    async def finish_encounter(self, encounter_id: str, success: bool, finished_at: float):
        await self._collection.update_one(
            {"encounter_id": encounter_id},
            {"$set": {"finished_at": finished_at, "is_completed_successfully": success}}
        )

    async def delete_by_encounter_id(self, encounter_id: str) -> bool:
        return await self.delete(encounter_id, id_field="encounter_id")

    async def reopen_encounter(self, encounter_id: str) -> bool:
        result = await self._collection.update_one(
            {"encounter_id": encounter_id},
            {"$set": {"finished_at": None}}
        )
        return result.modified_count > 0

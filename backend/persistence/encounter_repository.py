from typing import Optional
from backend.domain.models import Encounter, Message
from .base_repository import BaseRepository

class EncounterRepository(BaseRepository[Encounter]):
    def __init__(self):
        super().__init__("encounters", Encounter)

    async def get_by_encounter_id(self, encounter_id: str) -> Optional[Encounter]:
        doc = await self.collection.find_one({"encounter_id": encounter_id})
        if doc:
            return self.model_type(**doc)
        return None

    async def add_message(self, encounter_id: str, message: Message):
        await self.collection.update_one(
            {"encounter_id": encounter_id},
            {"$push": {"chat_history": message.model_dump()}}
        )

    async def finish_encounter(self, encounter_id: str, success: bool, finished_at: float):
        await self.collection.update_one(
            {"encounter_id": encounter_id},
            {"$set": {"finished_at": finished_at, "is_completed_successfully": success}}
        )

    async def reopen_encounter(self, encounter_id: str) -> bool:
        result = await self.collection.update_one(
            {"encounter_id": encounter_id},
            {"$set": {"finished_at": None, "is_completed_successfully": False}}
        )
        return result.modified_count > 0

    async def delete_by_encounter_id(self, encounter_id: str) -> bool:
        result = await self.collection.delete_one({"encounter_id": encounter_id})
        return result.deleted_count > 0

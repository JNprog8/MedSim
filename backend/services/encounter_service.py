import time
from typing import List, Optional
from backend.domain.models import Encounter, Message
from backend.persistence.encounter_repository import EncounterRepository

class EncounterService:
    def __init__(self, repository: EncounterRepository):
        self.repository = repository

    async def start_encounter(self, patient_id: str, student_id: Optional[str] = None, evaluator_name: Optional[str] = None) -> Encounter:
        encounter = Encounter(
            patient_id=patient_id,
            student_id=student_id,
            evaluator_name=evaluator_name
        )
        await self.repository.upsert(encounter, id_field="encounter_id")
        return encounter

    async def get_encounter(self, encounter_id: str) -> Optional[Encounter]:
        return await self.repository.get_by_encounter_id(encounter_id)

    async def add_message_to_history(self, encounter_id: str, role: str, content: str, audio_url: Optional[str] = None) -> Message:
        message = Message(role=role, content=content, audio_url=audio_url)
        await self.repository.add_message(encounter_id, message)
        return message

    async def finish_encounter(self, encounter_id: str, success: bool = True):
        finished_at = time.time()
        await self.repository.finish_encounter(encounter_id, success, finished_at)
        return {"encounter_id": encounter_id, "finished_at": finished_at, "success": success}

    async def list_encounters(self, student_id: Optional[str] = None) -> List[Encounter]:
        query = {}
        if student_id:
            query["student_id"] = student_id
        return await self.repository.list_all(filter_query=query)

    async def list_public_encounters(self) -> List[Encounter]:
        """List encounters that are public/viewable (finished encounters)"""
        return await self.repository.list_all(filter_query={"finished_at": {"$exists": True}})

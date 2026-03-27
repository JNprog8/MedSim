from typing import Optional

from backend.domain.models import AudioAsset
from .base_repository import BaseRepository


class AudioRepository(BaseRepository[AudioAsset]):
    def __init__(self):
        super().__init__("audio_assets", AudioAsset)

    async def get_audio(self, audio_id: str) -> Optional[AudioAsset]:
        return await self.get_by_id(audio_id)

    async def delete_by_encounter_id(self, encounter_id: str) -> int:
        result = await self.collection.delete_many({"encounter_id": encounter_id})
        return result.deleted_count

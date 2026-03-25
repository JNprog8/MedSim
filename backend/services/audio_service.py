import base64
from typing import Optional

from backend.domain.models import AudioAsset
from backend.persistence.audio_repository import AudioRepository


class StoredAudio:
    def __init__(self, asset: AudioAsset):
        self.asset = asset

    @property
    def id(self) -> str:
        return self.asset.id

    @property
    def content_type(self) -> str:
        return self.asset.content_type

    def to_bytes(self) -> bytes:
        return base64.b64decode(self.asset.data_base64.encode("ascii"))


class AudioService:
    def __init__(self, repository: AudioRepository):
        self.repository = repository

    async def save_audio(self, encounter_id: str, audio_bytes: bytes, content_type: str = "audio/wav") -> AudioAsset:
        asset = AudioAsset(
            encounter_id=encounter_id,
            content_type=content_type,
            data_base64=base64.b64encode(audio_bytes).decode("ascii"),
        )
        await self.repository.upsert(asset)
        return asset

    async def get_audio(self, audio_id: str) -> Optional[StoredAudio]:
        asset = await self.repository.get_audio(audio_id)
        if not asset:
            return None
        return StoredAudio(asset)

    async def delete_audio_by_encounter(self, encounter_id: str) -> int:
        return await self.repository.delete_by_encounter_id(encounter_id)

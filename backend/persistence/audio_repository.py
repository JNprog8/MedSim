from typing import Optional
from motor.motor_asyncio import AsyncIOMotorDatabase
from backend.domain.models import AudioAsset
from .base_repository import BaseMongoRepository

class AudioRepository(BaseMongoRepository[AudioAsset]):
    """
    Repositorio especializado para la gestión de activos de audio.
    """
    def __init__(self, db: AsyncIOMotorDatabase):
        super().__init__(db, "audio_assets", AudioAsset)

    async def get_audio(self, audio_id: str) -> Optional[AudioAsset]:
        try:
            # get_by_id ya usa _map_mongo_doc
            return await self.get_by_id(audio_id)
        except Exception:
            return None

    async def delete_by_encounter_id(self, encounter_id: str) -> int:
        try:
            result = await self._collection.delete_many({"encounter_id": encounter_id})
            return result.deleted_count
        except Exception as e:
            raise RepositoryError(f"Error al eliminar audios del encuentro {encounter_id}", {"error": str(e)})


from typing import Any, Dict, List, Optional, Type, TypeVar, Generic
from pydantic import BaseModel
from motor.motor_asyncio import AsyncIOMotorCollection
from backend.core.database import get_database

T = TypeVar("T", bound=BaseModel)

class BaseRepository(Generic[T]):
    def __init__(self, collection_name: str, model_type: Type[T]):
        self.collection_name = collection_name
        self.model_type = model_type

    @property
    def collection(self) -> AsyncIOMotorCollection:
        return get_database()[self.collection_name]

    async def get_by_id(self, id_value: str, id_field: str = "id") -> Optional[T]:
        doc = await self.collection.find_one({id_field: id_value})
        if doc:
            return self.model_type(**doc)
        return None

    async def list_all(self, filter_query: Dict[str, Any] = None) -> List[T]:
        cursor = self.collection.find(filter_query or {})
        docs = await cursor.to_list(length=1000)
        result = []
        for doc in docs:
            # Handle MongoDB _id field mapping to id
            if "_id" in doc and "id" not in doc:
                doc["id"] = str(doc["_id"])
            result.append(self.model_type(**doc))
        return result

    async def upsert(self, item: T, id_field: str = "id") -> str:
        data = item.model_dump()
        id_val = data.get(id_field)
        await self.collection.update_one(
            {id_field: id_val},
            {"$set": data},
            upsert=True
        )
        return id_val

    async def delete(self, id_value: str, id_field: str = "id") -> bool:
        result = await self.collection.delete_one({id_field: id_value})
        return result.deleted_count > 0

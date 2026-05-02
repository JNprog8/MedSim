from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional, Type, TypeVar, Generic
from pydantic import BaseModel
from motor.motor_asyncio import AsyncIOMotorCollection, AsyncIOMotorDatabase

from backend.core.exceptions import RepositoryError, EntityNotFoundError

T = TypeVar("T", bound=BaseModel)

class IRepository(Generic[T], ABC):
    """
    Spec Definition: Interface para el patrón Repository.
    """
    @abstractmethod
    async def get_by_id(self, id_value: str, id_field: str = "id") -> T: ...

    @abstractmethod
    async def list_all(self, filter_query: Optional[Dict[str, Any]] = None) -> List[T]: ...

    @abstractmethod
    async def upsert(self, item: T, id_field: str = "id") -> str: ...

    @abstractmethod
    async def delete(self, id_value: str, id_field: str = "id") -> bool: ...


class BaseMongoRepository(IRepository[T], Generic[T]):
    """
    Implementation: Implementación concreta para MongoDB.
    """
    
    def __init__(self, db: AsyncIOMotorDatabase, collection_name: str, model_type: Type[T]):
        self.__db: AsyncIOMotorDatabase = db
        self._collection_name: str = collection_name
        self._model_type: Type[T] = model_type

    @property
    def _collection(self) -> AsyncIOMotorCollection:
        return self.__db[self._collection_name]

    async def get_by_id(self, id_value: str, id_field: str = "id") -> T:
        try:
            doc = await self._collection.find_one({id_field: id_value})
            if not doc:
                raise EntityNotFoundError(f"Entidad con {id_field}={id_value} no encontrada.")
            return self._map_mongo_doc(doc)
        except EntityNotFoundError:
            raise
        except Exception as e:
            raise RepositoryError(f"Error al buscar entidad {id_value}", {"error": str(e)})

    async def list_all(self, filter_query: Optional[Dict[str, Any]] = None) -> List[T]:
        try:
            cursor = self._collection.find(filter_query or {})
            docs = await cursor.to_list(length=1000)
            return [self._map_mongo_doc(doc) for doc in docs]
        except Exception as e:
            raise RepositoryError("Error al listar entidades", {"error": str(e)})

    async def upsert(self, item: T, id_field: str = "id") -> str:
        try:
            data = item.model_dump()
            id_val = data.get(id_field)
            if not id_val:
                raise RepositoryError("Upsert requiere un ID válido")

            await self._collection.update_one(
                {id_field: id_val},
                {"$set": data},
                upsert=True
            )
            return id_val
        except Exception as e:
            raise RepositoryError("Error en operación upsert", {"error": str(e)})

    async def delete(self, id_value: str, id_field: str = "id") -> bool:
        try:
            result = await self._collection.delete_one({id_field: id_value})
            return result.deleted_count > 0
        except Exception as e:
            raise RepositoryError(f"Error al eliminar ID {id_value}", {"error": str(e)})

    def _map_mongo_doc(self, doc: Dict[str, Any]) -> T:
        if "_id" in doc and "id" not in doc:
            doc["id"] = str(doc["_id"])
        return self._model_type(**doc)

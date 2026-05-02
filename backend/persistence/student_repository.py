from typing import Optional
from motor.motor_asyncio import AsyncIOMotorDatabase
from backend.domain.models import StudentProfile
from .base_repository import BaseMongoRepository

class StudentRepository(BaseMongoRepository[StudentProfile]):
    def __init__(self, db: AsyncIOMotorDatabase):
        super().__init__(db, "students", StudentProfile)

    async def get_student_id(self, student_id: str) -> Optional[StudentProfile]:
        try:
            return await self.get_by_id(student_id)
        except Exception:
            return None

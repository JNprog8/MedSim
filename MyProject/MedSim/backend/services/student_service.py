from typing import List, Optional
from backend.domain.models import StudentProfile
from backend.persistence.student_repository import StudentRepository

class StudentService:
    def __init__(self, repository: StudentRepository):
        self.repository = repository

    async def get_all_students(self) -> List[StudentProfile]:
        return await self.repository.list_all()

    async def get_student_id(self, student_id: str) -> Optional[StudentProfile]:
        return await self.repository.get_by_id(student_id)

    async def create_or_update_student(self, student: StudentProfile) -> str:
        return await self.repository.upsert(student)

    async def delete_student(self, student_id: str) -> bool:
        return await self.repository.delete(student_id)

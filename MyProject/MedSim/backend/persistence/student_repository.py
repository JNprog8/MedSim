from backend.domain.models import StudentProfile
from .base_repository import BaseRepository

class StudentRepository(BaseRepository[StudentProfile]):
    def __init__(self):
        super().__init__("students", StudentProfile)

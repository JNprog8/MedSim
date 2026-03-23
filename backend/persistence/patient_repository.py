from backend.domain.models import PatientProfile
from .base_repository import BaseRepository

class PatientRepository(BaseRepository[PatientProfile]):
    def __init__(self):
        super().__init__("patients", PatientProfile)

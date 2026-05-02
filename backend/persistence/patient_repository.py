from motor.motor_asyncio import AsyncIOMotorDatabase
from backend.domain.models import PatientProfile
from .base_repository import BaseMongoRepository

class PatientRepository(BaseMongoRepository[PatientProfile]):
    """
    Repositorio especializado para la gestión de perfiles de pacientes.
    """
    def __init__(self, db: AsyncIOMotorDatabase):
        super().__init__(db, "patients", PatientProfile)

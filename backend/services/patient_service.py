from typing import List, Optional
from backend.domain.models import PatientProfile
from backend.persistence.patient_repository import PatientRepository

class PatientService:
    def __init__(self, repository: PatientRepository):
        self.repository = repository

    async def get_all_patients(self) -> List[PatientProfile]:
        return await self.repository.list_all()

    async def get_patient_by_id(self, patient_id: str) -> Optional[PatientProfile]:
        return await self.repository.get_by_id(patient_id)

    async def create_or_update_patient(self, patient: PatientProfile) -> str:
        return await self.repository.upsert(patient)

    async def delete_patient(self, patient_id: str) -> bool:
        return await self.repository.delete(patient_id)

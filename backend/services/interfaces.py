from abc import ABC, abstractmethod
from typing import Dict, List, Optional
from backend.domain.models import PatientProfile

class IPatientService(ABC):
    """
    Spec Definition: Interface para el servicio de gestión de pacientes.
    """
    @abstractmethod
    async def get_all_patients(self) -> List[PatientProfile]: ...

    @abstractmethod
    async def get_patient_by_id(self, patient_id: str) -> PatientProfile: ...

    @abstractmethod
    async def create_or_update_patient(self, patient: PatientProfile) -> str: ...

    @abstractmethod
    async def delete_patient(self, patient_id: str) -> bool: ...

    @abstractmethod
    def build_student_view(self, patient: PatientProfile) -> Dict: ...

from typing import Dict, List, Optional

from backend.domain.models import PatientProfile
from backend.persistence.base_repository import IRepository
from backend.services.interfaces import IPatientService
from backend.core.exceptions import MedSimException, PatientServiceError

class PatientService(IPatientService):
    """
    Implementation: Servicio de lógica de negocio para Pacientes.
    Aplica DIP al depender de la interfaz IRepository.
    """
    
    def __init__(self, repository: IRepository[PatientProfile]):
        self.__repository = repository

    def _normalize_patient(self, patient: PatientProfile) -> PatientProfile:
        if not patient.last_name and patient.administrative and patient.administrative.full_name:
            full = patient.administrative.full_name.strip()
            if full.lower().startswith(patient.name.lower()):
                patient.last_name = full[len(patient.name):].strip()
        return patient

    async def get_all_patients(self) -> List[PatientProfile]:
        try:
            patients = await self.__repository.list_all()
            return [self._normalize_patient(p) for p in patients]
        except Exception as e:
            raise PatientServiceError("No se pudieron recuperar los pacientes", {"error": str(e)})

    async def get_patient_by_id(self, patient_id: str) -> PatientProfile:
        try:
            patient = await self.__repository.get_by_id(patient_id)
            return self._normalize_patient(patient)
        except Exception as e:
            raise PatientServiceError(f"Error al obtener el paciente {patient_id}", {"error": str(e)})

    async def create_or_update_patient(self, patient: PatientProfile) -> str:
        try:
            return await self.__repository.upsert(patient)
        except Exception as e:
            raise PatientServiceError("Error al persistir el paciente", {"error": str(e)})

    async def delete_patient(self, patient_id: str) -> bool:
        try:
            return await self.__repository.delete(patient_id)
        except Exception as e:
            raise PatientServiceError(f"Error al eliminar el paciente {patient_id}", {"error": str(e)})

    def build_student_view(self, patient: PatientProfile) -> Dict:
        """Misma vista inicial que recibe el estudiante en el endpoint del encuentro."""
        return patient.to_student_view()

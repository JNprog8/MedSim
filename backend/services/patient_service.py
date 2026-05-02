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

    async def get_all_patients(self) -> List[PatientProfile]:
        try:
            return await self.__repository.list_all()
        except Exception as e:
            raise PatientServiceError("No se pudieron recuperar los pacientes", {"error": str(e)})

    async def get_patient_by_id(self, patient_id: str) -> PatientProfile:
        try:
            return await self.__repository.get_by_id(patient_id)
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
        """
        Construye una vista filtrada para el estudiante.
        Usa Dictionary Comprehension para eficiencia.
        """
        keys_to_export = [
            "id", "name", "age", "region", "chief_complaint", 
            "what_they_feel", "symptoms_reported"
        ]
        
        view = {key: getattr(patient, key) for key in keys_to_export}
        
        # Agregar sub-modelos serializados
        view.update({
            "administrative": patient.administrative.model_dump(),
            "triage": patient.triage.model_dump(),
            "institutional_history": patient.institutional_history.model_dump(),
            "recent_studies": patient.recent_studies.model_dump(),
        })
        
        return view

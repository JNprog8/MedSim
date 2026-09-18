from typing import List, Optional, Any, Union, Dict
from fastapi import APIRouter, HTTPException, Body
from pydantic import BaseModel, ConfigDict
from backend.domain.models import PatientProfile
from backend.services.container import services

router = APIRouter()


class PatientFormPayload(BaseModel):
    model_config = ConfigDict(extra="allow")

    id: str
    first_name: str
    last_name: str = ""
    age: int
    region: str = "AMBA"
    avatar: str = "female"
    voice: str = "0"
    date_of_birth: Optional[str] = None
    dni: Optional[str] = None
    insurance: Optional[str] = None
    sex: Optional[str] = None
    occupation: Optional[str] = None
    triage_short: Optional[str] = None
    chief_complaint: Optional[str] = None
    what_they_feel: Optional[str] = None
    spontaneous_info: Optional[str] = None
    conditional_info: Optional[str] = None
    symptoms: Optional[List[Any]] = None
    symptoms_text: str = ""
    known_history_text: str = ""
    diagnoses_text: str = ""
    surgeries_text: str = ""
    allergies_text: str = ""
    medications_text: str = ""
    labs_text: str = ""
    imaging_text: str = ""
    notes_text: str = ""
    unknown_real_problem: str = "(Completar)"
    doctor_display_real_problem: str = "(Completar)"
    true_main: str = ""
    true_differentials_text: str = ""
    true_plan: str = ""
    true_rx: str = ""
    response_style: str = "Calmado"
    personality: str = "Neutral"
    language_level: str = "B"
    medical_history_recall: str = "Low"
    cognitive_confusion: str = "Normal"
    speaking_style: str = "rioplatense"


@router.get("/", response_model=List[PatientProfile])
async def list_patients():
    return await services.patient_service.get_all_patients()

from backend.services.factories import PatientFactory
from backend.core.exceptions import EntityNotFoundError, PatientServiceError

@router.get("/{patient_id}", response_model=PatientProfile)
@router.get("/{patient_id}/", response_model=PatientProfile, include_in_schema=False)
async def get_patient(patient_id: str):
    try:
        return await services.patient_service.get_patient_by_id(patient_id)
    except EntityNotFoundError:
        raise HTTPException(status_code=404, detail="Patient not found")
    except PatientServiceError as e:
        raise HTTPException(status_code=500, detail=str(e))

from typing import List, Optional, Union

@router.post("/", response_model=str)
async def create_patient(payload: Union[PatientProfile, PatientFormPayload, dict] = Body(...)):
    try:
        if isinstance(payload, PatientProfile):
            patient = payload
        elif isinstance(payload, PatientFormPayload):
            patient = PatientFactory.build_from_form(payload.model_dump())
        elif "administrative" in payload or "triage" in payload or "institutional_history" in payload:
            patient = PatientProfile(**payload)
        else:
            patient = PatientFactory.build_from_form(payload)
        return await services.patient_service.create_or_update_patient(patient)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error en validación de paciente: {str(e)}")

@router.delete("/{patient_id}")
async def delete_patient(patient_id: str):
    success = await services.patient_service.delete_patient(patient_id)
    if not success:
        raise HTTPException(status_code=404, detail="Patient not found")
    return {"status": "deleted"}

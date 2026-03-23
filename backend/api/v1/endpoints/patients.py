from typing import List
from fastapi import APIRouter, HTTPException, Depends
from backend.domain.models import PatientProfile
from backend.services.container import services

router = APIRouter()

@router.get("/", response_model=List[PatientProfile])
async def list_patients():
    return await services.patient_service.get_all_patients()

@router.get("/{patient_id}", response_model=PatientProfile)
async def get_patient(patient_id: str):
    patient = await services.patient_service.get_patient_by_id(patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return patient

@router.post("/", response_model=str)
async def create_patient(patient: PatientProfile):
    return await services.patient_service.create_or_update_patient(patient)

@router.delete("/{patient_id}")
async def delete_patient(patient_id: str):
    success = await services.patient_service.delete_patient(patient_id)
    if not success:
        raise HTTPException(status_code=404, detail="Patient not found")
    return {"status": "deleted"}

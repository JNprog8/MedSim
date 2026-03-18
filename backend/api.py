import json
import time
from pathlib import Path
import mimetypes

from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, JSONResponse

from backend.domain.models import PatientProfile, StudentProfile
from backend.services import services

router = APIRouter()
SERVER_SCHEMA_VERSION = 3
_AUDIO_NAME_SAFE = set("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_.")

@router.get("/api/patients")
async def list_patients():
    patients = await services.patient_service.get_all_patients()
    out = []
    for p in patients:
        out.append({
            "id": p.id_ref,
            "name": p.name,
            "age": p.age,
            "condition": p.condition,
        })
    return {"patients": out}

@router.get("/api/patients/{patient_id}")
async def get_patient_by_id(patient_id: str):
    profile = await services.patient_service.get_patient(patient_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Patient not found")
    return {"patient": profile.model_dump()}

@router.post("/api/encounters/start")
async def begin_encounter(request: Request):
    try:
        payload = await request.json()
    except:
        raise HTTPException(status_code=400, detail="Expected JSON body")
    
    patient_id = (payload.get("patient_id") or "").strip()
    mode = services.encounter_service.normalize_mode(payload.get("mode"))
    
    try:
        encounter = await services.encounter_service.start_encounter(
            patient_id, mode, request, 
            student_id=payload.get("student_id"), 
            evaluator_name=payload.get("evaluator_name")
        )
        return encounter
    except KeyError:
        raise HTTPException(status_code=404, detail="Patient not found")

@router.get("/api/encounters/{encounter_id}")
async def read_encounter(encounter_id: str, request: Request):
    encounter = await services.encounter_service.get_encounter(encounter_id, request)
    if not encounter:
        raise HTTPException(status_code=404, detail="Encounter not found")
    return encounter

@router.get("/api/students")
async def list_students():
    students = await services.student_service.get_all_students()
    return {"students": [s.model_dump() for s in students]}

@router.get("/api/students/{student_id}")
async def get_student_by_id(student_id: str):
    profile = await services.student_service.get_student(student_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Student not found")
    return {"student": profile.model_dump()}

# ... Mantenemos el resto de endpoints de configuración que ya eran asíncronos o no tocaban DB

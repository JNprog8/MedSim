from typing import List, Optional
from fastapi import APIRouter, HTTPException, Body, Request
from pydantic import BaseModel
from backend.domain.models import Encounter
from backend.services.container import services

router = APIRouter()


class EncounterFinishRequest(BaseModel):
    success: bool = True
    final_diagnosis: Optional[str] = None
    differential: Optional[str] = None
    plan: Optional[str] = None
    prescription: Optional[str] = None


def build_true_case_payload(patient) -> dict:
    true_case = patient.true_case
    if true_case:
        payload = true_case.model_dump()
    else:
        payload = {
            "diagnostico_principal": patient.doctor_display_real_problem or patient.unknown_real_problem,
            "diferenciales": [],
            "indicaciones_plan": "",
            "receta": None,
        }
    return payload

@router.get("/models")
async def get_available_models():
    try:
        model = await services.llm_service.get_first_available_model()
        return {"models": [model]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/start", response_model=Encounter)
async def start_encounter(
    patient_id: str = Body(..., embed=True),
    student_id: Optional[str] = Body(None, embed=True),
    evaluator_name: Optional[str] = Body(None, embed=True)
):
    return await services.encounter_service.start_encounter(patient_id, student_id, evaluator_name)

@router.get("/{encounter_id}", response_model=Encounter)
async def get_encounter(encounter_id: str):
    encounter = await services.encounter_service.get_encounter(encounter_id)
    if not encounter:
        raise HTTPException(status_code=404, detail="Encounter not found")
    return encounter

@router.get("/{encounter_id}/history")
async def get_encounter_history(encounter_id: str):
    encounter = await services.encounter_service.get_encounter(encounter_id)
    if not encounter:
        raise HTTPException(status_code=404, detail="Encounter not found")
    # Return formatted for frontend
    visible = [m.model_dump() for m in encounter.chat_history if m.role != "system"]
    return {
        "encounter_id": encounter_id,
        "patient_id": encounter.patient_id,
        "messages": [m.model_dump() for m in encounter.chat_history],
        "visible_messages": visible
    }

@router.get("/{encounter_id}/student_view")
async def get_student_view(encounter_id: str):
    encounter = await services.encounter_service.get_encounter(encounter_id)
    if not encounter:
        raise HTTPException(status_code=404, detail="Encounter not found")

    patient = await services.patient_service.get_patient_by_id(encounter.patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient profile not found")

    return {
        "encounter_id": encounter.encounter_id,
        "patient_id": encounter.patient_id,
        "finished_at": encounter.finished_at,
        "can_send_messages": encounter.finished_at is None,
        "patient": services.patient_service.build_student_view(patient),
    }

@router.post("/{encounter_id}/link")
async def link_encounter(encounter_id: str, request: Request):
    """Link an existing encounter to a student's session/request"""
    # Simply return the encounter if it exists for now, 
    # ensuring the frontend can continue its flow
    encounter = await services.encounter_service.get_encounter(encounter_id)
    if not encounter:
        raise HTTPException(status_code=404, detail="Encounter not found")
    return {"status": "linked", "encounter_id": encounter_id}

@router.post("/{encounter_id}/finish")
async def finish_encounter(encounter_id: str, payload: EncounterFinishRequest = Body(default_factory=EncounterFinishRequest)):
    encounter = await services.encounter_service.get_encounter(encounter_id)
    if not encounter:
        raise HTTPException(status_code=404, detail="Encounter not found")

    patient = await services.patient_service.get_patient_by_id(encounter.patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient profile not found")

    result = await services.encounter_service.finish_encounter(encounter_id, payload.success)
    true_case = build_true_case_payload(patient)
    await services.realtime_hub.broadcast(
        encounter_id,
        {"finished_at": result["finished_at"], "success": result["success"]},
        msg_type="encounter_finished",
    )
    return {
        **result,
        "true_case": true_case,
        "true_diagnosis": true_case.get("diagnostico_principal", ""),
        "true_details": true_case.get("indicaciones_plan", ""),
        "student_submission": {
            "final_diagnosis": payload.final_diagnosis or "",
            "differential": payload.differential or "",
            "plan": payload.plan or "",
            "prescription": payload.prescription or "",
        },
    }

@router.post("/{encounter_id}/reopen")
async def reopen_encounter(encounter_id: str):
    encounter = await services.encounter_service.reopen_encounter(encounter_id)
    if not encounter:
        raise HTTPException(status_code=404, detail="Encounter not found")
    await services.realtime_hub.broadcast(
        encounter_id,
        {"finished_at": encounter.finished_at},
        msg_type="encounter_reopened",
    )
    return {
        "status": "reopened",
        "encounter_id": encounter_id,
        "finished_at": encounter.finished_at,
    }

@router.get("", response_model=List[Encounter])
async def list_encounters(student_id: Optional[str] = None):
    return await services.encounter_service.list_encounters(student_id)

@router.get("/public")
async def list_public_encounters():
    """List encounters that are public/viewable"""
    return await build_public_encounter_view()

@router.get("/saved", response_model=List[Encounter])
async def list_saved_encounters(request: Request):
    """List encounters saved by the current user"""
    # This might need authentication context, for now return empty list
    return []

# Module-level functions for router.py compatibility
async def list_public_encounters_module():
    """List encounters that are public/viewable"""
    return await build_public_encounter_view()

async def list_saved_encounters_module(request: Request):
    """List encounters saved by the current user"""
    # This might need authentication context, for now return empty list
    return []


async def build_public_encounter_view():
    encounters = await services.encounter_service.list_public_encounters()
    rows = []
    for encounter in encounters:
        patient = await services.patient_service.get_patient_by_id(encounter.patient_id) if encounter.patient_id else None
        student = await services.student_service.get_student_id(encounter.student_id) if encounter.student_id else None
        finished = encounter.finished_at is not None
        rows.append({
            **encounter.model_dump(),
            "patient_name": patient.name if patient else "",
            "patient_label": f"{patient.name} ({patient.age})" if patient else encounter.patient_id or "-",
            "student_name": student.name if student else "",
            "student_identifier": student.student_identifier if student else "",
            "student_label": (
                f"{student.name} ({student.student_identifier})"
                if student and student.student_identifier
                else (student.name if student else (encounter.student_id or "-"))
            ),
            "finished": finished,
            "status_label": "Finalizada" if finished else "Activa",
        })
    return rows

from typing import List, Optional
from fastapi import APIRouter, HTTPException, Body, Request
from backend.domain.models import SegueEvaluation
from backend.services.container import services

router = APIRouter()

@router.get("/")
async def get_evaluation(encounter_id: str):
    evaluation = await services.evaluation_service.get_evaluation_by_encounter(encounter_id)
    if not evaluation:
        return {"evaluation": None}
    return {"evaluation": evaluation.model_dump()}

@router.post("/")
async def upsert_evaluation(evaluation: SegueEvaluation):
    try:
        saved_id = await services.evaluation_service.create_or_update_evaluation(evaluation)
        return {"status": "success", "id": saved_id, "evaluation": evaluation.model_dump()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{encounter_id}")
async def delete_evaluation(encounter_id: str):
    eval = await services.evaluation_service.get_evaluation_by_encounter(encounter_id)
    if not eval:
        raise HTTPException(status_code=404, detail="Evaluation not found")
    await services.evaluation_service.delete_evaluation(eval.id)
    return {"status": "deleted"}

@router.get("/saved")
async def list_saved_evaluations():
    evals = await services.evaluation_service.repository.list_all()
    return {"evaluations": [e.model_dump() for e in evals]}

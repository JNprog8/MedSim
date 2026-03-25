from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from backend.domain.models import SegueEvaluation
from backend.domain.segue_catalog import SEGUE_ITEMS, SEGUE_SECTIONS
from backend.services.container import services
from io import BytesIO

router = APIRouter()

@router.get("/catalog")
async def get_segue_catalog():
    return {
        "sections": SEGUE_SECTIONS,
        "criteria": [
            {
                "id": item["id"],
                "label": item["label"],
                "area": next(
                    (section["area"] for section in SEGUE_SECTIONS if any(section_item["id"] == item["id"] for section_item in section["items"])),
                    "",
                ),
            }
            for item in SEGUE_ITEMS
        ],
    }

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
        saved = await services.evaluation_service.get_evaluation_by_encounter(evaluation.encounter_id)
        return {"status": "success", "id": saved_id, "evaluation": saved.model_dump() if saved else evaluation.model_dump()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{encounter_id}/pdf")
async def download_evaluation_pdf(encounter_id: str):
    try:
        pdf_bytes = await services.evaluation_service.build_pdf_bytes(encounter_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    filename = f"evaluacion-segue-{encounter_id}.pdf"
    return StreamingResponse(
        BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )

@router.get("/{encounter_id}/view_model")
async def get_evaluation_view_model(encounter_id: str):
    try:
        return await services.evaluation_service.build_view_model(encounter_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

@router.delete("/{encounter_id}")
async def delete_evaluation(encounter_id: str):
    eval = await services.evaluation_service.get_evaluation_by_encounter(encounter_id)
    deleted_evaluation = False
    deleted_encounter = False

    if eval:
        deleted_evaluation = await services.evaluation_service.delete_evaluation(eval.id)

    deleted_encounter = await services.encounter_service.delete_encounter(encounter_id)
    deleted_audio_count = await services.audio_service.delete_audio_by_encounter(encounter_id)

    if not deleted_evaluation and not deleted_encounter and deleted_audio_count == 0:
        raise HTTPException(status_code=404, detail="Evaluation or encounter not found")

    return {
        "status": "deleted",
        "deleted_evaluation": deleted_evaluation,
        "deleted_encounter": deleted_encounter,
        "deleted_audio_count": deleted_audio_count,
    }

@router.get("/saved")
async def list_saved_evaluations():
    evals = await services.evaluation_service.repository.list_all()
    return {"evaluations": [e.model_dump() for e in evals]}

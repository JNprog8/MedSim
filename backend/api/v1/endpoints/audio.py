from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import Response
from backend.core.config import settings
from backend.services.container import services

router = APIRouter()
TEST_AUDIO_DIR = settings.BASE_DIR / "backend" / "test_audio_uploads"


@router.post("/test")
async def test_audio_upload(request: Request):
    audio_bytes = await request.body()
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Request body is empty")

    TEST_AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    filename = f"audio-test-{uuid4().hex}.wav"
    output_path = TEST_AUDIO_DIR / filename
    output_path.write_bytes(audio_bytes)
    content_type = request.headers.get("content-type") or "audio/wav"

    encounters = await services.encounter_service.list_public_encounters()
    active_encounter = next((enc for enc in encounters if enc and enc.finished_at is None), None)
    if not active_encounter:
        raise HTTPException(status_code=404, detail="No active encounter found")

    try:
        flow_result = await services.audio_orchestrator.process_audio_bytes(
            encounter_id=active_encounter.encounter_id,
            audio_bytes=audio_bytes,
            content_type=content_type,
            filename=filename,
        )
    except HTTPException as exc:
        detail = exc.detail if isinstance(exc.detail, dict) else {"message": str(exc.detail)}
        raise HTTPException(
            status_code=exc.status_code,
            detail={
                "saved_path": str(Path("backend") / "test_audio_uploads" / filename),
                "encounter_id": active_encounter.encounter_id,
                **detail,
            },
        )

    return {
        "ok": True,
        "encounter_id": active_encounter.encounter_id,
        "filename": filename,
        "saved_path": str(Path("backend") / "test_audio_uploads" / filename),
        "content_type": content_type,
        "size_bytes": len(audio_bytes),
        "result": flow_result,
    }

@router.get("/{audio_id}")
async def get_audio_file(audio_id: str):
    audio_asset = await services.audio_service.get_audio(audio_id)
    if not audio_asset:
        raise HTTPException(status_code=404, detail="Audio file not found")

    return Response(
        content=audio_asset.to_bytes(),
        media_type=audio_asset.content_type or "audio/wav",
    )

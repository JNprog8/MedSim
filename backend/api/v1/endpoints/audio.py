from pathlib import Path
from uuid import uuid4
import base64
import logging

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import Response
from backend.core.config import settings
from backend.services.container import services

router = APIRouter()
logger = logging.getLogger(__name__)
UNREAL_AUDIO_DIR = settings.BASE_DIR / "backend" / "unreal_audio_uploads"
UNREAL_AUDIO_RELATIVE_DIR = Path("backend") / "unreal_audio_uploads"


@router.post("/audio_unreal")
async def unreal_audio_upload(request: Request):
    audio_bytes = await request.body()
    if not audio_bytes:
        logger.error("Unreal audio upload rejected: empty request body")
        raise HTTPException(status_code=400, detail="Request body is empty")

    UNREAL_AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    filename = f"audio-unreal-{uuid4().hex}.wav"
    output_path = UNREAL_AUDIO_DIR / filename
    output_path.write_bytes(audio_bytes)
    content_type = request.headers.get("content-type") or "audio/wav"
    saved_path = str(UNREAL_AUDIO_RELATIVE_DIR / filename)

    logger.info(
        "Unreal audio upload received: bytes=%s content_type=%s saved_path=%s",
        len(audio_bytes),
        content_type,
        saved_path,
    )

    encounters = await services.encounter_service.list_public_encounters()
    active_encounter = next((enc for enc in encounters if enc and enc.finished_at is None), None)
    if not active_encounter:
        logger.error(
            "Unreal audio upload failed: no active encounter found saved_path=%s",
            saved_path,
        )
        raise HTTPException(status_code=404, detail="No active encounter found")

    logger.info(
        "Unreal audio upload using encounter_id=%s saved_path=%s",
        active_encounter.encounter_id,
        saved_path,
    )

    try:
        flow_result = await services.audio_orchestrator.process_audio_bytes(
            encounter_id=active_encounter.encounter_id,
            audio_bytes=audio_bytes,
            content_type=content_type,
            filename=filename,
        )
    except HTTPException as exc:
        detail = exc.detail if isinstance(exc.detail, dict) else {"message": str(exc.detail)}
        logger.exception(
            "Unreal audio upload processing failed: encounter_id=%s status_code=%s saved_path=%s detail=%s",
            active_encounter.encounter_id,
            exc.status_code,
            saved_path,
            detail,
        )
        raise HTTPException(
            status_code=exc.status_code,
            detail={
                "saved_path": saved_path,
                "encounter_id": active_encounter.encounter_id,
                **detail,
            },
        )
    except Exception:
        logger.exception(
            "Unreal audio upload unexpected failure: encounter_id=%s saved_path=%s",
            active_encounter.encounter_id,
            saved_path,
        )
        raise HTTPException(
            status_code=500,
            detail={
                "saved_path": saved_path,
                "encounter_id": active_encounter.encounter_id,
                "stage": "audio_unreal",
                "message": "Unexpected error while processing Unreal audio",
            },
        )

    assistant_audio = flow_result.get("assistant_audio") or flow_result.get("chat") or {}
    assistant_audio_base64 = assistant_audio.get("audio_base64")
    assistant_audio_content_type = assistant_audio.get("content_type") or "audio/wav"
    if not assistant_audio_base64:
        logger.error(
            "Unreal audio upload failed: assistant audio missing encounter_id=%s saved_path=%s reply_preview=%s",
            active_encounter.encounter_id,
            saved_path,
            (flow_result.get("reply_text") or "")[:120],
        )
        raise HTTPException(
            status_code=502,
            detail={
                "saved_path": saved_path,
                "encounter_id": active_encounter.encounter_id,
                "stage": "tts",
                "message": "Patient audio was not generated",
            },
        )

    try:
        assistant_audio_bytes = base64.b64decode(assistant_audio_base64.encode("ascii"))
    except Exception:
        logger.exception(
            "Unreal audio upload failed: generated audio decode error encounter_id=%s saved_path=%s content_type=%s",
            active_encounter.encounter_id,
            saved_path,
            assistant_audio_content_type,
        )
        raise HTTPException(
            status_code=500,
            detail={
                "saved_path": saved_path,
                "encounter_id": active_encounter.encounter_id,
                "stage": "tts",
                "message": "Generated patient audio could not be decoded",
            },
        )

    logger.info(
        "Unreal audio upload processed successfully: encounter_id=%s request_bytes=%s response_bytes=%s saved_path=%s",
        active_encounter.encounter_id,
        len(audio_bytes),
        len(assistant_audio_bytes),
        saved_path,
    )

    return Response(
        content=assistant_audio_bytes,
        media_type=assistant_audio_content_type,
        headers={
            "X-Encounter-Id": active_encounter.encounter_id,
            "X-Saved-Path": saved_path,
            "X-Reply-Text": flow_result.get("reply_text", "")[:200],
        },
    )

@router.get("/{audio_id}")
async def get_audio_file(audio_id: str):
    audio_asset = await services.audio_service.get_audio(audio_id)
    if not audio_asset:
        raise HTTPException(status_code=404, detail="Audio file not found")

    return Response(
        content=audio_asset.to_bytes(),
        media_type=audio_asset.content_type or "audio/wav",
    )

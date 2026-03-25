from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from backend.services.container import services

router = APIRouter()

@router.get("/{audio_id}")
async def get_audio_file(audio_id: str):
    audio_asset = await services.audio_service.get_audio(audio_id)
    if not audio_asset:
        raise HTTPException(status_code=404, detail="Audio file not found")

    return Response(
        content=audio_asset.to_bytes(),
        media_type=audio_asset.content_type or "audio/wav",
    )

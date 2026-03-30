from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import Response
from backend.services.container import services

router = APIRouter()


@router.post("/test")
async def test_audio_upload(request: Request):
    audio_bytes = await request.body()
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Request body is empty")

    return {
        "ok": True,
        "content_type": request.headers.get("content-type") or "application/octet-stream",
        "size_bytes": len(audio_bytes),
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

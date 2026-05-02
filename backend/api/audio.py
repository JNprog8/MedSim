import logging
from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import JSONResponse, Response
from backend.services.container import services

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/audio_unreal")
async def unreal_audio_upload(request: Request):
    """
    Endpoint para carga de audio desde Unreal Engine.
    Delega la lógica al UnrealAudioHandler (OO).
    """
    audio_bytes = await request.body()
    content_type = request.headers.get("content-type")
    
    result = await services.unreal_handler.handle_upload(audio_bytes, content_type)
    
    return JSONResponse(content=result)

@router.get("/{audio_id}")
async def get_audio_file(audio_id: str):
    """
    Recupera un archivo de audio por ID.
    """
    audio_asset = await services.audio_service.get_audio(audio_id)
    
    if not audio_asset:
        raise HTTPException(status_code=404, detail="Audio file not found")

    return Response(
        content=audio_asset.to_bytes(),
        media_type=audio_asset.content_type or "audio/wav",
    )

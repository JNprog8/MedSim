import mimetypes
from pathlib import Path
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from backend.core.config import settings

router = APIRouter()

@router.get("/{encounter_id}/{filename}")
async def get_audio_file(encounter_id: str, filename: str):
    path = (settings.audio_path / encounter_id / filename).resolve()
    if not path.exists() or not path.is_file():
        raise HTTPException(status_code=404, detail="Audio file not found")
    
    media_type, _ = mimetypes.guess_type(str(path))
    return FileResponse(path, media_type=media_type or "audio/wav")

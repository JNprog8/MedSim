from typing import List, Optional
from fastapi import APIRouter, HTTPException, Form, UploadFile, File, Request
from backend.services.container import services

router = APIRouter()

# Matches /api/chat
@router.post("/chat")
async def chat_completion(
    request: Request,
    message: str = Form(...),
    model: str = Form(None),
    patient_id: str = Form(None),
    encounter_id: str = Form(None),
    include_tts: bool = Form(False),
):
    if not encounter_id:
        raise HTTPException(status_code=400, detail="encounter_id is required")
    
    return await services.audio_orchestrator.process_text_input(
        encounter_id=encounter_id,
        text=message,
        include_tts=include_tts
    )

# Matches /api/audio_turn
@router.post("/audio_turn")
async def audio_turn(
    request: Request,
    file: UploadFile = File(...),
    model: str = Form(None),
    patient_id: str = Form(None),
    encounter_id: str = Form(None),
):
    if not encounter_id:
        raise HTTPException(status_code=400, detail="encounter_id is required")
        
    return await services.audio_orchestrator.process_audio_input(
        encounter_id=encounter_id,
        audio_file=file
    )

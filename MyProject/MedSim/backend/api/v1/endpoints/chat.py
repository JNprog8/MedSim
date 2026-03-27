from typing import Optional
from fastapi import APIRouter, HTTPException, Form, UploadFile, File, Request
from pydantic import BaseModel
from backend.services.container import services

router = APIRouter()


class ChatJsonRequest(BaseModel):
    encounter_id: str
    message: str
    include_tts: bool = False

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


@router.post("/chat_json")
async def chat_completion_json(payload: ChatJsonRequest):
    if not payload.encounter_id:
        raise HTTPException(status_code=400, detail="encounter_id is required")

    if not payload.message:
        raise HTTPException(status_code=400, detail="message is required")

    return await services.audio_orchestrator.process_text_input(
        encounter_id=payload.encounter_id,
        text=payload.message,
        include_tts=payload.include_tts,
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

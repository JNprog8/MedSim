from typing import Literal, Optional

from fastapi import APIRouter, Body, HTTPException, Form, UploadFile, File, Request
from pydantic import BaseModel
from backend.services.container import services

router = APIRouter()


class UnrealMessageRequest(BaseModel):
    message: str
    role: Literal["user", "assistant"] = "assistant"
    audio_url: Optional[str] = None

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
        
    return await services.audio_orchestrator.process_audio_input_by_mode(
        encounter_id=encounter_id,
        audio_file=file,
        mode="default",
    )

# Matches /api/audio_turn/with_unreal
@router.post("/audio_turn/with_unreal/{encounter_id}")
async def audio_turn_with_unreal(
    encounter_id: str,
    file: UploadFile = File(...),
):
    return await services.audio_orchestrator.process_audio_input_by_mode(
        encounter_id=encounter_id,
        audio_file=file,
        mode="unreal",
    )


@router.post("/chat/with_unreal/{encounter_id}")
async def chat_with_unreal(
    encounter_id: str,
    payload: UnrealMessageRequest = Body(...),
):
    return await services.audio_orchestrator.append_external_message(
        encounter_id=encounter_id,
        role=payload.role,
        text=payload.message,
        audio_url=payload.audio_url,
    )

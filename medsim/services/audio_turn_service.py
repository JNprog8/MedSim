from __future__ import annotations

from typing import Any, Dict, Optional

from services.encounter_service import EncounterService
from services.llm_service import LLMService
from services.patient_service import PatientService
from services.prompt_service import PromptService
from services.stt_service import STTService
from services.tts_service import TTSService
from domain.models import INTERVIEW_MODE_FREE


def clean_patient_reply(text: Optional[str]) -> str:
    if not text:
        return ""
    cleaned = text.strip()
    if cleaned.startswith("("):
        end = cleaned.find(")")
        if 0 < end < 240:
            inside = cleaned[1:end].lower()
            hints = ("language", "idioma", "anteced", "cognitive", "ansios", "desconfi", "impaciente")
            if any(hint in inside for hint in hints):
                cleaned = cleaned[end + 1 :].lstrip()
    if cleaned.startswith('"') and cleaned.endswith('"'):
        cleaned = cleaned[1:-1].strip()
    return cleaned


class AudioTurnService:
    def __init__(
        self,
        patient_service: PatientService,
        prompt_service: PromptService,
        encounter_service: EncounterService,
        llm_service: LLMService,
        stt_service: STTService,
        tts_service: TTSService,
    ):
        self.patient_service = patient_service
        self.prompt_service = prompt_service
        self.encounter_service = encounter_service
        self.llm_service = llm_service
        self.stt_service = stt_service
        self.tts_service = tts_service

    async def complete_chat(
        self,
        message: str,
        model: Optional[str],
        patient_id: Optional[str],
        encounter_id: Optional[str],
        request,
    ) -> Dict[str, Any]:
        if not message.strip():
            from fastapi import HTTPException
            raise HTTPException(status_code=400, detail="Message cannot be empty")

        from fastapi import HTTPException

        if not (encounter_id or "").strip():
            raise HTTPException(status_code=400, detail="encounter_id is required for persistent sessions")

        enc_id = encounter_id.strip()
        encounter = self.encounter_service.get_encounter(enc_id, request)
        if not encounter:
            raise HTTPException(status_code=404, detail=f"Encounter {enc_id} not found")

        chosen_patient_id = encounter.get("patient_id")
        patients = self.patient_service.load_patients()
        if not chosen_patient_id or chosen_patient_id not in patients:
            raise HTTPException(status_code=400, detail="Invalid patient in encounter")

        profile = patients[chosen_patient_id]
        
        # 1. Save user message to DB
        self.encounter_service.append_user_message(enc_id, message)
        
        # 2. Get full history from DB (including the message we just added)
        history = self.encounter_service.get_history(enc_id)

        # Model selection logic
        requested_model = (model or "").strip()
        locked_model = self.encounter_service.locked_model_by_history.get(enc_id)
        selected_model = locked_model or requested_model or self.llm_service.settings.patient_llm_model or await self.llm_service.get_first_available_model()
        self.encounter_service.locked_model_by_history[enc_id] = selected_model

        # 3. Call LLM
        reply = await self.llm_service.chat_with_model(history, selected_model, max_tokens=250, temperature=0.2)
        cleaned_reply = clean_patient_reply(reply)
        
        # 4. Save assistant reply to DB
        self.encounter_service.append_assistant_message(enc_id, cleaned_reply)

        return {
            "response": cleaned_reply,
            "model": selected_model,
            "model_locked": True,
            "mode": encounter.get("mode", INTERVIEW_MODE_FREE),
        }

    async def complete_turn(
        self,
        message: str,
        model: Optional[str],
        patient_id: Optional[str],
        encounter_id: Optional[str],
        request,
        include_tts: bool = False,
        speaker_wav=None,
    ) -> Dict[str, Any]:
        chat_payload = await self.complete_chat(message, model, patient_id, encounter_id, request)
        payload: Dict[str, Any] = {
            "user_text": message.strip(),
            "chat": chat_payload,
        }
        if include_tts:
            payload["tts"] = await self.tts_service.text_to_speech(
                chat_payload["response"],
                speaker_wav,
                patient_id=patient_id,
            )
        return payload

    async def transcribe_then_reply(
        self,
        audio_file,
        model: Optional[str],
        patient_id: Optional[str],
        encounter_id: Optional[str],
        request,
        speaker_wav=None,
    ) -> Dict[str, Any]:
        transcript = await self.stt_service.transcribe_audio(audio_file)
        user_text = str(transcript.get("text") or "").strip()
        turn_payload = await self.complete_turn(
            user_text,
            model,
            patient_id,
            encounter_id,
            request,
            include_tts=True,
            speaker_wav=speaker_wav,
        )
        turn_payload["transcript"] = transcript
        return turn_payload


AudioTurnService.clean_patient_reply = staticmethod(clean_patient_reply)

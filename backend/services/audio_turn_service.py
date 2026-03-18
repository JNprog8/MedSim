from __future__ import annotations

from typing import Any, Dict, Optional

from ..domain.models import INTERVIEW_MODE_FREE
from .encounter_service import EncounterService
from .llm_service import LLMService
from .patient_service import PatientService
from .prompt_service import PromptService
from .stt_service import STTService
from .tts_service import TTSService


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
    ) -> tuple[Dict[str, Any], str]:
        if not message.strip():
            from fastapi import HTTPException

            raise HTTPException(status_code=400, detail="Message cannot be empty")

        from fastapi import HTTPException

        session_id = self.encounter_service.get_session_id(request)
        patients = self.patient_service.load_patients()
        encounter = None

        if (encounter_id or "").strip():
            enc_id = encounter_id.strip()
            encounter = self.encounter_service.get_encounter(enc_id, request)
            if not encounter:
                raise HTTPException(status_code=404, detail="Encounter not found (start with POST /api/encounters/start)")
            if encounter.get("finished_at") is not None:
                raise HTTPException(status_code=409, detail="Encounter finished")
            chosen_patient_id = encounter.get("patient_id")
            history_id = enc_id
        else:
            chosen_patient_id = (patient_id or "").strip() or self.patient_service.get_default_patient_id(patients)
            # Keep ad-hoc chats private to this client/session.
            history_id = f"adhoc:{session_id}:{chosen_patient_id}"

        if not chosen_patient_id or chosen_patient_id not in patients:
            raise HTTPException(status_code=400, detail="No patients available (create one via POST /api/patients)")

        profile = patients[chosen_patient_id]
        history = self.encounter_service.ensure_history(history_id, profile)
        user_message_id = self.encounter_service.append_user_message(history_id, message)

        requested_model = (model or "").strip()
        locked_model = self.encounter_service.locked_model_by_history.get(history_id)
        selected_model = locked_model or requested_model or self.llm_service.settings.patient_llm_model or await self.llm_service.get_first_available_model()
        self.encounter_service.locked_model_by_history[history_id] = selected_model

        reply = await self.llm_service.chat_with_model(history, selected_model, max_tokens=250, temperature=0.2)
        cleaned_reply = clean_patient_reply(reply)

        return (
            {
                "response": cleaned_reply,
                "model": selected_model,
                "model_locked": True,
                "mode": encounter.get("mode", INTERVIEW_MODE_FREE) if encounter else INTERVIEW_MODE_FREE,
                "user_message_id": user_message_id,
            },
            history_id,
        )

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
        """Run one text turn (user -> LLM patient), optionally adding TTS for the patient reply.

        Returns a payload used by the student UI. The encounter history is updated and
        broadcast over WS to the evaluator.
        """
        chat_payload, history_key = await self.complete_chat(message, model, patient_id, encounter_id, request)
        payload: Dict[str, Any] = {
            "user_text": message.strip(),
            "chat": chat_payload,
        }
        tts_payload: Optional[Dict[str, Any]] = None
        if include_tts:
            tts_payload = await self.tts_service.text_to_speech(
                chat_payload["response"],
                speaker_wav,
                patient_id=patient_id,
            )
            payload["tts"] = tts_payload
        message_id = self.encounter_service.append_assistant_message(history_key, chat_payload["response"], tts_payload)
        chat_payload["message_id"] = message_id
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
        """STT + patient reply.

        Flow:
        - Read raw mic audio bytes so we can persist them for evaluator replay.
        - Transcribe via STT.
        - Run a normal complete_turn with include_tts=True (patient voice).
        - Attach the original user mic audio to the *user message* via message_id.
        """
        raw_audio = await audio_file.read()
        try:
            audio_file.file.seek(0)
        except Exception:
            pass
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
        try:
            session_id = self.encounter_service.get_session_id(request)
            if (encounter_id or "").strip():
                history_key = encounter_id.strip()
            else:
                history_key = f"adhoc:{session_id}:{(patient_id or '').strip()}"
            user_message_id = str(turn_payload.get("chat", {}).get("user_message_id") or "").strip()
            if user_message_id and raw_audio:
                self.encounter_service.annotate_message_with_audio_bytes(
                    history_key,
                    user_message_id,
                    raw_audio,
                    getattr(audio_file, "content_type", None) or "audio/wav",
                )
        except Exception:
            # Best-effort: audio replay is optional.
            pass
        turn_payload["transcript"] = transcript
        return turn_payload


AudioTurnService.clean_patient_reply = staticmethod(clean_patient_reply)

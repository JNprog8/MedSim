from __future__ import annotations

import asyncio
import base64
import json
import mimetypes
import shutil
import time
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional

from ..domain.models import INTERVIEW_MODE_FREE, PatientProfile, VALID_INTERVIEW_MODES
from .patient_service import PatientService
from .prompt_service import PromptService
from .realtime.hub import EncounterRealtimeHub
from .settings import AppSettings, load_settings
from backend.infrastructure.persistence.models import EncounterDocument, PatientDocument

class EncounterService:
    MAX_STORED_MESSAGES = 24

    def __init__(
        self,
        patient_service: PatientService,
        prompt_service: PromptService,
        settings: AppSettings | None = None,
        realtime_hub: EncounterRealtimeHub | None = None,
    ):
        self.patient_service = patient_service
        self.prompt_service = prompt_service
        self.settings = settings or load_settings()
        self.realtime_hub = realtime_hub

    async def _get_encounter_doc(self, encounter_id: str) -> Optional[EncounterDocument]:
        return await EncounterDocument.find_one(EncounterDocument.encounter_id == encounter_id)

    async def start_encounter(
        self,
        patient_id: str,
        mode: str,
        request,
        student_id: str | None = None,
        evaluator_name: str | None = None,
    ) -> Dict[str, Any]:
        patient_doc = await self.patient_service.get_patient(patient_id)
        if not patient_doc:
            raise KeyError("Patient not found")
        
        session_id = self.get_session_id(request)
        encounter_id = uuid.uuid4().hex
        
        # Build initial system prompt
        system_content = self.prompt_service.build_patient_system_prompt(
            PatientProfile(
                id=patient_doc.id_ref,
                name=patient_doc.name,
                age=patient_doc.age,
                condition=patient_doc.condition,
                system_prompt=patient_doc.system_prompt
            )
        )

        doc = EncounterDocument(
            encounter_id=encounter_id,
            session_id=session_id,
            patient_id=patient_id,
            student_id=(student_id or "").strip() or None,
            evaluator_name=(evaluator_name or "").strip() or None,
            mode=self.normalize_mode(mode),
            chat_history=[{"role": "system", "content": system_content}],
            started_at=time.time()
        )
        await doc.insert()
        return doc.model_dump()

    async def get_encounter(self, encounter_id: str, request=None) -> Optional[Dict[str, Any]]:
        doc = await self._get_encounter_doc(encounter_id)
        return doc.model_dump() if doc else None

    async def finish_encounter(self, encounter_id: str, payload: Dict[str, Any], request=None) -> Dict[str, Any]:
        doc = await self._get_encounter_doc(encounter_id)
        if not doc:
            raise KeyError("Encounter not found")
        
        patient_doc = await self.patient_service.get_patient(doc.patient_id)
        if not patient_doc:
            raise KeyError("Patient not found")

        doc.doctor_submission = payload
        doc.finished_at = time.time()
        await doc.save()

        if self.realtime_hub:
            await self.realtime_hub.broadcast(encounter_id, {"finished_at": doc.finished_at}, "encounter_finished")

        return {
            "encounter_id": encounter_id,
            "patient_id": doc.patient_id,
            "mode": doc.mode,
            "doctor_submission": payload,
            "true_diagnosis": patient_doc.doctor_display_real_problem,
            "true_details": patient_doc.unknown_real_problem,
            "finished_at": doc.finished_at,
        }

    async def append_user_message(self, encounter_id: str, message: str) -> str:
        doc = await self._get_encounter_doc(encounter_id)
        if not doc: raise KeyError("Encounter not found")
        
        message_id = uuid.uuid4().hex
        doc.chat_history.append({"role": "user", "content": message, "message_id": message_id})
        await doc.save()
        
        await self._emit_message_event(encounter_id, "user", message, message_id=message_id)
        return message_id

    async def append_assistant_message(self, encounter_id: str, message: str, tts_payload: Optional[Dict[str, Any]] = None) -> str:
        doc = await self._get_encounter_doc(encounter_id)
        if not doc: raise KeyError("Encounter not found")
        
        message_id = uuid.uuid4().hex
        stored_tts = await self._compact_tts_payload(encounter_id, message_id, tts_payload)
        
        doc.chat_history.append({"role": "assistant", "content": message, "tts": stored_tts, "message_id": message_id})
        
        if len(doc.chat_history) > self.MAX_STORED_MESSAGES:
            doc.chat_history = [doc.chat_history[0]] + doc.chat_history[-(self.MAX_STORED_MESSAGES-1):]
            
        await doc.save()
        await self._emit_message_event(encounter_id, "assistant", message, stored_tts, message_id=message_id)
        return message_id

    async def _compact_tts_payload(self, encounter_id: str, message_id: str, tts_payload: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        if not tts_payload: return None
        # Implementación simplificada para el ejemplo (mantiene lógica de archivos para audio por ahora)
        audio_b64 = tts_payload.get("audio_base64")
        if audio_b64:
            # Aquí seguiría la lógica de persistir a disco el audio, que es correcta para archivos grandes
            return self._persist_audio(encounter_id, message_id, tts_payload)
        return tts_payload

    async def _emit_message_event(self, encounter_id: str, role: str, content: str, tts_payload=None, message_id=None, msg_type="message_added"):
        if self.realtime_hub:
            event = {"role": role, "content": content, "message_id": message_id, "tts": tts_payload}
            await self.realtime_hub.broadcast(encounter_id, event, msg_type)

    # Métodos auxiliares mantenidos (sync por ahora si no tocan DB)
    def get_session_id(self, request) -> str:
        header = request.headers.get("x-session-id") or request.headers.get("X-Session-Id")
        return header.strip() if header else str(uuid.uuid4())

    def normalize_mode(self, mode: Optional[str]) -> str:
        value = (mode or "").strip().lower()
        return value if value in VALID_INTERVIEW_MODES else INTERVIEW_MODE_FREE

    def _persist_audio(self, encounter_id: str, message_id: str, tts_payload: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        # Mantenemos lógica de archivos para audio para evitar saturar BSON de MongoDB
        audio_b64 = str(tts_payload.get("audio_base64") or "").strip()
        content_type = str(tts_payload.get("content_type") or "audio/wav").strip()
        try:
            audio_bytes = base64.b64decode(audio_b64)
            out_dir = self.settings.audio_dir / encounter_id
            out_dir.mkdir(parents=True, exist_ok=True)
            filename = f"{message_id}.wav"
            (out_dir / filename).write_bytes(audio_bytes)
            return {"audio_url": f"/api/audio/{encounter_id}/{filename}", "content_type": content_type}
        except: return None

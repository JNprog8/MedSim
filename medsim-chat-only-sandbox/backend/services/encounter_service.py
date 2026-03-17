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


class EncounterService:
    """Manage in-memory encounter state (chat history + WebSocket broadcast).

    Key ideas:
    - Each message gets a stable `message_id` so the frontend can attach audio later
      (e.g. after STT finishes) via a `tts_update` WS event.
    - We persist audio to disk and broadcast a small `tts` payload that contains
      `audio_url` instead of big base64 blobs (keeps WS traffic small).
    """

    MAX_STORED_MESSAGES = 24  # includes 1 system prompt + last N-1 turns

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
        # We scope encounter chat by encounter_id (multi-user). For non-encounter "ad-hoc"
        # chats we use a synthetic key so they don't collide.
        self.chat_histories: Dict[str, List[dict]] = {}
        self.locked_model_by_history: Dict[str, str] = {}
        self.encounters: Dict[str, Dict[str, Any]] = {}
        self._load_saved_encounters()

    def _load_saved_encounters(self) -> None:
        """Load persisted encounter state from disk (best-effort).

        This lets the evaluator "vincular conversacion" by encounter_id even after a server restart.
        """
        enc_dir = getattr(self.settings, "encounters_dir", None)
        if not enc_dir:
            return
        try:
            enc_dir.mkdir(parents=True, exist_ok=True)
            files = list(enc_dir.glob("*.json"))
        except Exception:
            return

        for path in files:
            try:
                payload = json.loads(path.read_text(encoding="utf-8"))
                enc = payload.get("encounter") or {}
                history = payload.get("history") or []
                enc_id = str(enc.get("encounter_id") or "").strip()
                if not enc_id:
                    continue
                self.encounters[enc_id] = enc
                self.chat_histories[enc_id] = history
            except Exception:
                # Ignore broken files.
                continue

    def _persist_encounter_state(self, encounter_id: str) -> None:
        """Persist encounter metadata + full history to disk (best-effort)."""
        enc_id = str(encounter_id or "").strip()
        if not enc_id or enc_id not in self.encounters:
            return
        enc_dir = getattr(self.settings, "encounters_dir", None)
        if not enc_dir:
            return
        try:
            enc_dir.mkdir(parents=True, exist_ok=True)
            out_path = enc_dir / f"{enc_id}.json"
            payload = {
                "schema_version": 1,
                "saved_at": time.time(),
                "encounter": self.encounters.get(enc_id),
                "history": self.chat_histories.get(enc_id, []),
            }
            out_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        except Exception:
            # Persistence is a convenience; the app still works without it.
            pass

    def adopt_encounter_to_session(self, encounter_id: str, new_session_id: str) -> Dict[str, Any]:
        """Best-effort "link" used by the frontend for backwards compatibility.

        Encounters are no longer scoped by session_id (multi-user). We keep this to
        record the last session that opened the encounter, but it does not affect access.
        """
        enc_id = (encounter_id or "").strip()
        if not enc_id:
            raise KeyError("Encounter not found")
        encounter = self.encounters.get(enc_id)
        if not encounter:
            raise KeyError("Encounter not found")

        new_sid = (new_session_id or "").strip()
        if not new_sid:
            raise ValueError("session_id is required")

        encounter["last_linked_session_id"] = new_sid
        self._persist_encounter_state(enc_id)
        return encounter

    def _ext_for_content_type(self, content_type: str) -> str:
        # Keep this conservative: it only affects the saved filename extension.
        ct = (content_type or "").strip().lower()
        ext = "bin"
        if "mpeg" in ct or "mp3" in ct:
            ext = "mp3"
        elif "wav" in ct:
            ext = "wav"
        elif "ogg" in ct:
            ext = "ogg"
        else:
            guessed = mimetypes.guess_extension(ct) if ct else None
            if guessed:
                ext = guessed.lstrip(".")
        return ext or "bin"

    def _persist_audio_bytes(
        self,
        encounter_id: str,
        message_id: str,
        audio_bytes: bytes,
        content_type: str,
    ) -> Optional[Dict[str, Any]]:
        if not audio_bytes or not message_id:
            return None

        enc_id = str(encounter_id or "").strip()
        if not enc_id or enc_id not in self.encounters:
            return None

        out_dir = self.settings.audio_dir / enc_id
        out_dir.mkdir(parents=True, exist_ok=True)

        ext = self._ext_for_content_type(content_type)
        filename = f"{message_id}.{ext}"
        out_path = out_dir / filename
        try:
            out_path.write_bytes(audio_bytes)
        except Exception:
            # Best-effort persistence.
            return None
        return {
            "audio_url": f"/api/audio/{enc_id}/{filename}",
            "content_type": (content_type or "application/octet-stream").strip(),
            "size_bytes": len(audio_bytes),
        }

    def _persist_audio(self, encounter_id: str, message_id: str, tts_payload: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        audio_b64 = str(tts_payload.get("audio_base64") or "").strip()
        if not audio_b64 or not message_id:
            return None
        content_type = str(tts_payload.get("content_type") or "application/octet-stream").strip()
        try:
            audio_bytes = base64.b64decode(audio_b64)
        except Exception:
            return None
        return self._persist_audio_bytes(encounter_id, message_id, audio_bytes, content_type)

    def _compact_tts_payload(
        self, encounter_id: str, message_id: str, tts_payload: Optional[Dict[str, Any]]
    ) -> Optional[Dict[str, Any]]:
        """Persist audio to disk and store a small payload for WS/history.

        We avoid broadcasting megabytes of base64 over WebSocket. The student UI
        still receives base64 in the HTTP response; evaluator replays via URL.
        """
        if not tts_payload:
            return None
        persisted = self._persist_audio(encounter_id, message_id, tts_payload)
        if persisted:
            return persisted
        # Fallback: keep original payload (might be large), but don't crash.
        return tts_payload

    def get_session_id(self, request) -> str:
        # The UI generally provides a stable `X-Session-Id` so evaluator/student share the same encounter.
        header = request.headers.get("x-session-id") or request.headers.get("X-Session-Id")
        if header and header.strip():
            return header.strip()
        return str(hash(f"{request.client.host}|{request.headers.get('user-agent', '')}"))

    def normalize_mode(self, mode: Optional[str]) -> str:
        value = (mode or "").strip().lower()
        return value if value in VALID_INTERVIEW_MODES else INTERVIEW_MODE_FREE

    def start_encounter(
        self,
        patient_id: str,
        mode: str,
        request,
        student_id: str | None = None,
        evaluator_name: str | None = None,
    ) -> Dict[str, Any]:
        profile = self.patient_service.get_patient(patient_id)
        if not profile:
            raise KeyError("Patient not found")
        session_id = self.get_session_id(request)
        encounter_id = uuid.uuid4().hex
        self.chat_histories[encounter_id] = [
            {"role": "system", "content": self.prompt_service.build_patient_system_prompt(profile)}
        ]
        self.encounters[encounter_id] = {
            "encounter_id": encounter_id,
            # Kept for UI/backwards-compat; access is no longer scoped by session_id.
            "session_id": session_id,
            "created_by_session_id": session_id,
            "patient_id": patient_id,
            "student_id": (student_id or "").strip() or None,
            "evaluator_name": (evaluator_name or "").strip() or None,
            "mode": self.normalize_mode(mode),
            "started_at": time.time(),
            "finished_at": None,
            "doctor_submission": None,
        }
        self._persist_encounter_state(encounter_id)
        return self.encounters[encounter_id]

    def get_encounter(self, encounter_id: str, request) -> Optional[Dict[str, Any]]:
        # Encounter access is scoped by encounter_id (multi-user).
        return self.encounters.get(encounter_id)

    def get_encounter_by_session(self, encounter_id: str, session_id: str) -> Optional[Dict[str, Any]]:
        # Backwards-compat helper used by WS/older clients. session_id is ignored.
        return self.encounters.get(encounter_id)

    def finish_encounter(self, encounter_id: str, payload: Dict[str, Any], request) -> Dict[str, Any]:
        encounter = self.get_encounter(encounter_id, request)
        if not encounter:
            raise KeyError("Encounter not found")
        profile = self.patient_service.get_patient(encounter["patient_id"])
        if not profile:
            raise KeyError("Patient not found")
        encounter["doctor_submission"] = payload
        encounter["finished_at"] = time.time()
        self._persist_encounter_state(encounter_id)

        # Notify any connected evaluator UIs so they lock the session.
        if self.realtime_hub:
            try:
                asyncio.create_task(
                    self.realtime_hub.broadcast(
                        encounter_id,
                        {"finished_at": encounter["finished_at"]},
                        msg_type="encounter_finished",
                    )
                )
            except RuntimeError:
                pass
        reveal = profile.true_case or PatientProfile.TrueCaseReveal(
            diagnostico_principal=profile.doctor_display_real_problem,
            diferenciales=[],
            indicaciones_plan=profile.unknown_real_problem,
            receta=None,
        )
        return {
            "encounter_id": encounter_id,
            "patient_id": encounter["patient_id"],
            "mode": encounter.get("mode", INTERVIEW_MODE_FREE),
            "doctor_submission": payload,
            "true_diagnosis": profile.doctor_display_real_problem,
            "true_details": profile.unknown_real_problem,
            "true_case": reveal.model_dump(),
            "finished_at": encounter["finished_at"],
        }

    def reopen_encounter(self, encounter_id: str, request) -> Dict[str, Any]:
        """Re-open a previously finished encounter so the student can continue chatting.

        This clears `finished_at` and any previous `doctor_submission` payload, but keeps
        the existing chat history intact.
        """
        encounter = self.get_encounter(encounter_id, request)
        if not encounter:
            raise KeyError("Encounter not found")

        # If already open, treat as a no-op for idempotency.
        encounter["finished_at"] = None
        encounter["doctor_submission"] = None
        self._persist_encounter_state(encounter_id)

        if self.realtime_hub:
            try:
                asyncio.create_task(
                    self.realtime_hub.broadcast(
                        encounter_id,
                        {"finished_at": None},
                        msg_type="encounter_reopened",
                    )
                )
            except RuntimeError:
                pass

        return {
            "encounter_id": encounter_id,
            "patient_id": encounter.get("patient_id"),
            "student_id": encounter.get("student_id"),
            "evaluator_name": encounter.get("evaluator_name"),
            "mode": encounter.get("mode", INTERVIEW_MODE_FREE),
            "started_at": encounter.get("started_at"),
            "finished_at": None,
        }

    def purge_encounter(self, encounter_id: str) -> Dict[str, Any]:
        """Delete an encounter from memory and disk (history + audio), best-effort.

        Used when the evaluator deletes a saved evaluation and wants to remove the
        linked conversation + any persisted audio files too.
        """
        enc_id = str(encounter_id or "").strip()
        if not enc_id:
            raise ValueError("encounter_id is required")
        # Prevent path traversal / nested paths (encounter_id is uuid hex).
        if enc_id != (Path(enc_id).name) or any(sep in enc_id for sep in ("/", "\\")):
            raise ValueError("Invalid encounter_id")

        enc = self.encounters.get(enc_id) if isinstance(self.encounters.get(enc_id), dict) else None
        prior_session_id = str(enc.get("session_id") or "").strip() if enc else ""

        # Remove in-memory encounter + its history/model.
        self.encounters.pop(enc_id, None)
        self.chat_histories.pop(enc_id, None)
        self.locked_model_by_history.pop(enc_id, None)

        # Delete persisted encounter JSON (if present).
        enc_deleted = False
        enc_dir = getattr(self.settings, "encounters_dir", None)
        if enc_dir:
            try:
                path = (enc_dir / f"{enc_id}.json").resolve()
                base = enc_dir.resolve()
                path.relative_to(base)
                if path.exists() and path.is_file():
                    path.unlink()
                    enc_deleted = True
            except Exception:
                pass

        # Delete persisted audio folder for this encounter (if present).
        audio_deleted = False
        try:
            audio_dir = getattr(self.settings, "audio_dir", None)
            if audio_dir:
                folder = (audio_dir / enc_id).resolve()
                base = audio_dir.resolve()
                folder.relative_to(base)
                if folder.exists() and folder.is_dir():
                    shutil.rmtree(folder, ignore_errors=True)
                    audio_deleted = True
        except Exception:
            pass

        # Best-effort: notify connected clients.
        if self.realtime_hub:
            try:
                asyncio.create_task(
                    self.realtime_hub.broadcast(
                        enc_id,
                        {"encounter_id": enc_id},
                        msg_type="encounter_deleted",
                    )
                )
            except RuntimeError:
                pass

        return {"encounter_id": enc_id, "encounter_deleted": enc_deleted, "audio_deleted": audio_deleted}

    def get_history(self, history_id: str) -> List[dict]:
        return self.chat_histories.setdefault(history_id, [])

    def ensure_history(self, history_id: str, profile: PatientProfile) -> List[dict]:
        if history_id not in self.chat_histories:
            self.chat_histories[history_id] = [
                {"role": "system", "content": self.prompt_service.build_patient_system_prompt(profile)}
            ]
            self.locked_model_by_history.pop(history_id, None)
        return self.chat_histories[history_id]

    def _emit_message_event(
        self,
        history_id: str,
        role: str,
        content: str,
        tts_payload: Optional[Dict[str, Any]] = None,
        message_id: Optional[str] = None,
        msg_type: str = "message_added",
    ) -> None:
        # msg_type:
        # - "message_added": a new message bubble should be appended
        # - "tts_update": an existing bubble (identified by message_id) should attach audio controls
        if not self.realtime_hub:
            return
        # Only broadcast for real encounters (history_id == encounter_id).
        if history_id not in self.encounters:
            return
        event = {"role": role, "content": content}
        if message_id:
            event["message_id"] = message_id
        if tts_payload:
            event["tts"] = tts_payload
        try:
            asyncio.create_task(self.realtime_hub.broadcast(history_id, event, msg_type))
        except RuntimeError:
            # No running loop (should not happen under FastAPI), ignore.
            pass

    def append_user_message(self, history_id: str, message: str) -> str:
        message_id = uuid.uuid4().hex
        self.chat_histories[history_id].append({"role": "user", "content": message, "message_id": message_id})
        self._emit_message_event(history_id, "user", message, message_id=message_id)
        if history_id in self.encounters:
            self._persist_encounter_state(history_id)
        return message_id

    def append_assistant_message(
        self,
        history_id: str,
        message: str,
        tts_payload: Optional[Dict[str, Any]] = None,
    ) -> str:
        message_id = uuid.uuid4().hex
        stored_tts = self._compact_tts_payload(history_id, message_id, tts_payload)
        self.chat_histories[history_id].append(
            {"role": "assistant", "content": message, "tts": stored_tts, "message_id": message_id}
        )
        self._emit_message_event(history_id, "assistant", message, stored_tts, message_id=message_id)
        if len(self.chat_histories[history_id]) > self.MAX_STORED_MESSAGES:
            history = self.chat_histories[history_id]
            system_msg = history[0]
            keep = self.MAX_STORED_MESSAGES - 1
            self.chat_histories[history_id] = [system_msg] + history[-keep:]
        if history_id in self.encounters:
            self._persist_encounter_state(history_id)
        return message_id

    def annotate_message_with_tts(
        self,
        history_id: str,
        message_id: str,
        tts_payload: Dict[str, Any],
    ) -> None:
        messages = self.chat_histories.get(history_id, [])
        target = None
        for msg in reversed(messages):
            if msg.get("message_id") == message_id:
                target = msg
                break
        if not target:
            raise KeyError("Message not found")
        stored_tts = self._compact_tts_payload(history_id, message_id, tts_payload)
        target["tts"] = stored_tts
        self._emit_message_event(
            history_id,
            target["role"],
            target["content"],
            stored_tts,
            message_id=message_id,
            msg_type="tts_update",
        )
        if history_id in self.encounters:
            self._persist_encounter_state(history_id)

    def annotate_message_with_audio_bytes(
        self,
        history_id: str,
        message_id: str,
        audio_bytes: bytes,
        content_type: str,
    ) -> None:
        """Attach an already-recorded audio blob (e.g. user's microphone) to an existing message."""
        messages = self.chat_histories.get(history_id, [])
        target = None
        for msg in reversed(messages):
            if msg.get("message_id") == message_id:
                target = msg
                break
        if not target:
            raise KeyError("Message not found")
        persisted = self._persist_audio_bytes(history_id, message_id, audio_bytes, content_type)
        if not persisted:
            raise RuntimeError("Audio persistence failed")
        target["tts"] = persisted
        self._emit_message_event(
            history_id,
            target["role"],
            target["content"],
            persisted,
            message_id=message_id,
            msg_type="tts_update",
        )
        if history_id in self.encounters:
            self._persist_encounter_state(history_id)

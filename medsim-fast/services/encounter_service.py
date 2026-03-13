from __future__ import annotations

import time
import uuid
from typing import Any, Dict, List, Optional, Tuple

from domain.models import INTERVIEW_MODE_FREE, PatientProfile, VALID_INTERVIEW_MODES
from services.patient_service import PatientService
from services.prompt_service import PromptService
from services.database_service import DatabaseService


class EncounterService:
    def __init__(self, patient_service: PatientService, prompt_service: PromptService, database_service: DatabaseService):
        self.patient_service = patient_service
        self.prompt_service = prompt_service
        self.database_service = database_service
        self.locked_model_by_history: Dict[str, str] = {} # Still in memory for now, could be in DB too

    def get_session_id(self, request) -> str:
        header = request.headers.get("x-session-id") or request.headers.get("X-Session-Id")
        if header and header.strip():
            return header.strip()
        # Fallback to a stable hash if no header, but we should encourage headers
        return str(hash(f"{request.client.host}|{request.headers.get('user-agent', '')}"))

    def normalize_mode(self, mode: Optional[str]) -> str:
        value = (mode or "").strip().lower()
        return value if value in VALID_INTERVIEW_MODES else INTERVIEW_MODE_FREE

    def start_encounter(self, patient_id: str, mode: str, request) -> Dict[str, Any]:
        profile = self.patient_service.get_patient(patient_id)
        if not profile:
            raise KeyError("Patient not found")
        
        session_id = self.get_session_id(request)
        encounter_id = uuid.uuid4().hex
        started_at = time.time()
        
        # Persist encounter
        self.database_service.create_encounter(
            encounter_id=encounter_id,
            session_id=session_id,
            patient_id=patient_id,
            mode=self.normalize_mode(mode),
            started_at=started_at
        )
        
        # Persist system prompt as first message
        system_prompt = self.prompt_service.build_patient_system_prompt(profile)
        self.database_service.add_message(encounter_id, "system", system_prompt, started_at)
        
        return {
            "encounter_id": encounter_id,
            "session_id": session_id,
            "patient_id": patient_id,
            "mode": self.normalize_mode(mode),
            "started_at": started_at,
            "finished_at": None,
            "doctor_submission": None,
        }

    def get_encounter(self, encounter_id: str, request) -> Optional[Dict[str, Any]]:
        # We still check session_id for basic security if provided
        session_id = self.get_session_id(request)
        encounter = self.database_service.get_encounter(encounter_id)
        # If we want to be strict: if encounter and encounter.get("session_id") != session_id: return None
        return encounter

    def get_active_encounter(self, request) -> Optional[Dict[str, Any]]:
        session_id = self.get_session_id(request)
        return self.database_service.get_active_encounter_by_session(session_id)

    def finish_encounter(self, encounter_id: str, payload: Dict[str, Any], request) -> Dict[str, Any]:
        encounter = self.get_encounter(encounter_id, request)
        if not encounter:
            raise KeyError("Encounter not found")
        
        profile = self.patient_service.get_patient(encounter["patient_id"])
        if not profile:
            raise KeyError("Patient not found")
        
        finished_at = time.time()
        self.database_service.finish_encounter(encounter_id, finished_at, payload)
        
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
            "finished_at": finished_at,
        }

    def get_history(self, encounter_id: str) -> List[dict]:
        return self.database_service.get_messages(encounter_id)

    def ensure_history(self, encounter_id: str, profile: PatientProfile) -> List[dict]:
        history = self.get_history(encounter_id)
        if not history:
            # This should normally not happen if start_encounter was called
            system_prompt = self.prompt_service.build_patient_system_prompt(profile)
            self.database_service.add_message(encounter_id, "system", system_prompt, time.time())
            history = [{"role": "system", "content": system_prompt}]
        return history

    def append_user_message(self, encounter_id: str, message: str) -> None:
        self.database_service.add_message(encounter_id, "user", message, time.time())

    def append_assistant_message(self, encounter_id: str, message: str) -> None:
        self.database_service.add_message(encounter_id, "assistant", message, time.time())

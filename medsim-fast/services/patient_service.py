from __future__ import annotations

import json
import logging
import re
from pathlib import Path
from typing import Dict, Optional

from domain.models import PatientProfile

logger = logging.getLogger(__name__)

PATIENT_ID_RE = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9_-]{1,63}$")


class PatientService:
    def __init__(self, patients_dir: Path):
        self.patients_dir = patients_dir

    def load_patients(self) -> Dict[str, PatientProfile]:
        patients: Dict[str, PatientProfile] = {}
        try:
            if not self.patients_dir.exists():
                return patients
            for path in sorted(self.patients_dir.glob("*.json")):
                try:
                    data = json.loads(path.read_text(encoding="utf-8"))
                    profile = PatientProfile.model_validate(data)
                    patients[profile.id] = profile
                except Exception as exc:
                    logger.warning("Skipping invalid patient profile %s: %s", path, exc)
        except Exception as exc:
            logger.warning("Failed to load patients from %s: %s", self.patients_dir, exc)
        return patients

    def get_patient(self, patient_id: str) -> Optional[PatientProfile]:
        return self.load_patients().get(patient_id)

    def get_default_patient_id(self, patients: Dict[str, PatientProfile]) -> Optional[str]:
        return next(iter(patients.keys()), None)

    def save_patient(self, profile: PatientProfile) -> Path:
        if not PATIENT_ID_RE.match(profile.id):
            raise ValueError("Invalid patient id (use letters/numbers/_/-; 2-64 chars)")
        self.patients_dir.mkdir(parents=True, exist_ok=True)
        path = self.patients_dir / f"{profile.id}.json"
        path.write_text(json.dumps(profile.model_dump(), ensure_ascii=False, indent=2), encoding="utf-8")
        return path

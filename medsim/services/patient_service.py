from __future__ import annotations

import json
import logging
import re
from pathlib import Path
from typing import Dict, Optional

from domain.models import PatientProfile

logger = logging.getLogger(__name__)

# Expresión regular compilada una sola vez para eficiencia
PATIENT_ID_RE = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9_-]{1,63}$")


class PatientService:
    def __init__(self, patients_dir: Path):
        self.patients_dir = patients_dir
        self._cache: Dict[str, PatientProfile] = {}
        self._last_loaded: float = 0

    def load_patients(self, force_reload: bool = False) -> Dict[str, PatientProfile]:
        """Carga los pacientes del disco con soporte para caché."""
        if self._cache and not force_reload:
            return self._cache

        if not self.patients_dir.exists():
            logger.error("Directorio de pacientes no encontrado: %s", self.patients_dir)
            return {}

        # Carga funcional de pacientes usando list comprehension y validación Pydantic
        paths = sorted(self.patients_dir.glob("*.json"))
        loaded_profiles = []
        
        for path in paths:
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
                loaded_profiles.append(PatientProfile.model_validate(data))
            except Exception as exc:
                logger.warning("Error al cargar perfil %s: %s", path.name, exc)

        # Actualizar caché: transformamos la lista en un diccionario
        self._cache = {p.id: p for p in loaded_profiles}
        return self._cache

    def get_patient(self, patient_id: str) -> Optional[PatientProfile]:
        """Obtiene un paciente por ID de la caché."""
        return self.load_patients().get(patient_id)

    def get_default_patient_id(self) -> Optional[str]:
        """Obtiene el primer ID disponible de manera funcional."""
        patients = self.load_patients()
        return next(iter(patients.keys()), None)

    def save_patient(self, profile: PatientProfile) -> Path:
        """Valida y guarda un perfil de paciente en disco."""
        if not PATIENT_ID_RE.match(profile.id):
            raise ValueError(f"ID de paciente inválido: {profile.id}")

        dest = self.patients_dir / f"{profile.id}.json"
        dest.write_text(profile.model_dump_json(indent=2), encoding="utf-8")
        
        # Invalidar caché local para el paciente guardado
        self._cache[profile.id] = profile
        return dest

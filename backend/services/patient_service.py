from __future__ import annotations

import json
import logging
import re
from pathlib import Path
from typing import List, Optional
from backend.infrastructure.persistence.models import PatientDocument
from ..domain.models import PatientProfile

logger = logging.getLogger(__name__)

PATIENT_ID_RE = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9_-]{1,63}$")

class PatientService:
    def __init__(self, patients_dir: Path):
        self.patients_dir = patients_dir

    async def migrate_json_to_db(self):
        if not self.patients_dir.exists():
            return
        
        for path in sorted(self.patients_dir.glob("*.json")):
            try:
                data = json.loads(path.read_text(encoding="utf-8-sig"))
                profile = PatientProfile.model_validate(data)
                
                existing = await PatientDocument.find_one(PatientDocument.id == profile.id)
                if not existing:
                    # Al heredar de PatientProfile, podemos pasar el objeto directamente al constructor del Documento
                    doc = PatientDocument(**profile.model_dump())
                    await doc.insert()
                    logger.info(f"Patient {profile.id} migrated to DB.")
            except Exception as exc:
                logger.warning(f"Failed to migrate patient {path}: {exc}")

    async def get_all_patients(self) -> List[PatientProfile]:
        # Recuperamos los documentos de la DB y los devolvemos como perfiles de dominio
        docs = await PatientDocument.find_all().to_list()
        return [PatientProfile(**doc.model_dump()) for doc in docs]

    async def get_patient(self, patient_id: str) -> Optional[PatientProfile]:
        doc = await PatientDocument.find_one(PatientDocument.id == patient_id)
        if not doc:
            return None
        # Convertimos de Documento a Perfil de Dominio (Mapper)
        return PatientProfile(**doc.model_dump())

    async def save_patient(self, profile: PatientProfile) -> PatientProfile:
        if not PATIENT_ID_RE.match(profile.id):
            raise ValueError("Invalid patient id")
            
        doc = await PatientDocument.find_one(PatientDocument.id == profile.id)
        if doc:
            # Actualizamos el documento con los nuevos datos del perfil
            await doc.update({"$set": profile.model_dump()})
        else:
            doc = PatientDocument(**profile.model_dump())
            await doc.insert()
        return profile

    async def delete_patient(self, patient_id: str) -> bool:
        doc = await PatientDocument.find_one(PatientDocument.id == patient_id)
        if not doc:
            return False
        await doc.delete()
        return True

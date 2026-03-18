from __future__ import annotations

import json
import logging
import re
from pathlib import Path
from typing import Dict, List, Optional
from backend.infrastructure.persistence.models import StudentDocument
from ..domain.models import StudentProfile

logger = logging.getLogger(__name__)

STUDENT_ID_RE = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9_-]{1,63}$")

class StudentService:
    def __init__(self, students_dir: Path):
        self.students_dir = students_dir

    async def migrate_json_to_db(self):
        """Migra archivos JSON existentes a la base de datos MongoDB."""
        if not self.students_dir.exists():
            return
        
        for path in sorted(self.students_dir.glob("*.json")):
            try:
                data = json.loads(path.read_text(encoding="utf-8-sig"))
                profile = StudentProfile.model_validate(data)
                
                # Buscar si ya existe para evitar duplicados
                existing = await StudentDocument.find_one(StudentDocument.id_ref == profile.id)
                if not existing:
                    doc = StudentDocument(
                        id_ref=profile.id,
                        name=profile.name
                    )
                    await doc.insert()
                    logger.info(f"Student {profile.id} migrated to DB.")
            except Exception as exc:
                logger.warning(f"Failed to migrate student {path}: {exc}")

    async def get_all_students(self) -> List[StudentDocument]:
        return await StudentDocument.find_all().to_list()

    async def get_student(self, student_id: str) -> Optional[StudentDocument]:
        return await StudentDocument.find_one(StudentDocument.id_ref == student_id)

    async def save_student(self, profile: StudentProfile) -> StudentDocument:
        if not STUDENT_ID_RE.match(profile.id):
            raise ValueError("Invalid student id")
            
        existing = await self.get_student(profile.id)
        if existing:
            existing.name = profile.name
            await existing.save()
            return existing
        else:
            doc = StudentDocument(
                id_ref=profile.id,
                name=profile.name
            )
            await doc.insert()
            return doc

    async def delete_student(self, student_id: str) -> bool:
        doc = await self.get_student(student_id)
        if not doc:
            return False
        await doc.delete()
        return True

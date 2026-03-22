from __future__ import annotations

import json
import logging
import re
from pathlib import Path
from typing import Dict, Optional

from ..domain.models import StudentProfile

logger = logging.getLogger(__name__)

STUDENT_ID_RE = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9_-]{1,63}$")


class StudentService:
    def __init__(self, students_dir: Path):
        self.students_dir = students_dir

    def load_students(self) -> Dict[str, StudentProfile]:
        students: Dict[str, StudentProfile] = {}
        try:
            if not self.students_dir.exists():
                return students
            for path in sorted(self.students_dir.glob("*.json")):
                try:
                    data = json.loads(path.read_text(encoding="utf-8-sig"))
                    profile = StudentProfile.model_validate(data)
                    students[profile.id] = profile
                except Exception as exc:
                    logger.warning("Skipping invalid student profile %s: %s", path, exc)
        except Exception as exc:
            logger.warning("Failed to load students from %s: %s", self.students_dir, exc)
        return students

    def get_student(self, student_id: str) -> Optional[StudentProfile]:
        return self.load_students().get(student_id)

    def save_student(self, profile: StudentProfile) -> Path:
        if not STUDENT_ID_RE.match(profile.id):
            raise ValueError("Invalid student id (use letters/numbers/_/-; 2-64 chars)")
        self.students_dir.mkdir(parents=True, exist_ok=True)
        path = self.students_dir / f"{profile.id}.json"
        path.write_text(json.dumps(profile.model_dump(), ensure_ascii=False, indent=2), encoding="utf-8")
        return path

    def delete_student(self, student_id: str) -> bool:
        safe = str(student_id or "").strip()
        if not STUDENT_ID_RE.match(safe):
            raise ValueError("Invalid student id")
        path = (self.students_dir / f"{safe}.json")
        if not path.exists():
            return False
        path.unlink()
        return True

from __future__ import annotations

import json
import logging
import time
from pathlib import Path
from typing import Optional

from ..domain.models import SegueEvaluation

logger = logging.getLogger(__name__)


class EvaluationService:
    def __init__(self, evaluations_dir: Path):
        self.evaluations_dir = evaluations_dir

    def _path_for_encounter(self, encounter_id: str) -> Path:
        safe = str(encounter_id or "").strip()
        if not safe:
            raise ValueError("encounter_id is required")
        # Prevent path traversal / nested paths.
        if safe != Path(safe).name or any(sep in safe for sep in ("/", "\\")):
            raise ValueError("Invalid encounter_id")
        # encounter_id is uuid hex in this app; keep it simple.
        self.evaluations_dir.mkdir(parents=True, exist_ok=True)
        return self.evaluations_dir / f"evaluation_{safe}.json"

    def get_by_encounter(self, encounter_id: str) -> Optional[SegueEvaluation]:
        try:
            path = self._path_for_encounter(encounter_id)
            if not path.exists():
                return None
            data = json.loads(path.read_text(encoding="utf-8-sig"))
            return SegueEvaluation.model_validate(data)
        except Exception as exc:
            logger.warning("Failed to read evaluation for %s: %s", encounter_id, exc)
            return None

    def upsert(self, evaluation: SegueEvaluation) -> Path:
        now = time.time()
        payload = evaluation.model_dump()
        if not payload.get("created_at"):
            payload["created_at"] = now
        payload["updated_at"] = now
        path = self._path_for_encounter(str(payload.get("encounter_id") or "").strip())
        path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        return path

    def delete_by_encounter(self, encounter_id: str) -> bool:
        """Delete the evaluation JSON for a given encounter_id (if it exists)."""
        path = self._path_for_encounter(encounter_id)
        if not path.exists():
            return False
        path.unlink()
        return True

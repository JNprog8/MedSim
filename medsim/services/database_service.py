import sqlite3
import json
from pathlib import Path
from typing import List, Dict, Any, Optional

class DatabaseService:
    def __init__(self, db_path: Path):
        self.db_path = db_path
        self._init_db()

    def _get_connection(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self):
        with self._get_connection() as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS encounters (
                    id TEXT PRIMARY KEY,
                    session_id TEXT,
                    patient_id TEXT,
                    mode TEXT,
                    started_at REAL,
                    finished_at REAL,
                    doctor_submission TEXT
                )
            """)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS messages (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    encounter_id TEXT,
                    role TEXT,
                    content TEXT,
                    timestamp REAL,
                    FOREIGN KEY (encounter_id) REFERENCES encounters (id)
                )
            """)
            conn.commit()

    def create_encounter(self, encounter_id: str, session_id: str, patient_id: str, mode: str, started_at: float):
        with self._get_connection() as conn:
            conn.execute(
                "INSERT INTO encounters (id, session_id, patient_id, mode, started_at) VALUES (?, ?, ?, ?, ?)",
                (encounter_id, session_id, patient_id, mode, started_at)
            )
            conn.commit()

    def get_encounter(self, encounter_id: str) -> Optional[Dict[str, Any]]:
        with self._get_connection() as conn:
            row = conn.execute("SELECT * FROM encounters WHERE id = ?", (encounter_id,)).fetchone()
            if row:
                res = dict(row)
                if res["doctor_submission"]:
                    res["doctor_submission"] = json.loads(res["doctor_submission"])
                return res
        return None

    def finish_encounter(self, encounter_id: str, finished_at: float, doctor_submission: Dict[str, Any]):
        with self._get_connection() as conn:
            conn.execute(
                "UPDATE encounters SET finished_at = ?, doctor_submission = ? WHERE id = ?",
                (finished_at, json.dumps(doctor_submission), encounter_id)
            )
            conn.commit()

    def add_message(self, encounter_id: str, role: str, content: str, timestamp: float):
        with self._get_connection() as conn:
            conn.execute(
                "INSERT INTO messages (encounter_id, role, content, timestamp) VALUES (?, ?, ?, ?)",
                (encounter_id, role, content, timestamp)
            )
            conn.commit()

    def get_messages(self, encounter_id: str) -> List[Dict[str, Any]]:
        with self._get_connection() as conn:
            rows = conn.execute(
                "SELECT role, content FROM messages WHERE encounter_id = ? ORDER BY timestamp ASC, id ASC",
                (encounter_id,)
            ).fetchall()
            return [dict(row) for row in rows]

    def get_active_encounter_by_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        with self._get_connection() as conn:
            row = conn.execute(
                "SELECT * FROM encounters WHERE session_id = ? AND finished_at IS NULL ORDER BY started_at DESC LIMIT 1",
                (session_id,)
            ).fetchone()
            if row:
                res = dict(row)
                if res["doctor_submission"]:
                    res["doctor_submission"] = json.loads(res["doctor_submission"])
                return res
        return None

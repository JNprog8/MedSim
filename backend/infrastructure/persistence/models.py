from typing import Optional, List, Dict, Any
from beanie import Document, Indexed
from pydantic import Field
from datetime import datetime
from backend.domain.models import PatientProfile, StudentProfile, SegueEvaluation

class PatientDocument(Document, PatientProfile):
    # Hereda todos los campos de PatientProfile
    # Anotamos el campo id de PatientProfile como indexado y único si es necesario, 
    # pero como ya viene de PatientProfile (Pydantic), Beanie lo manejará.
    # Si queremos forzar un índice único en el campo 'id' de la interfaz:
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "patients"
        indexes = [
            "id", # Beanie creará un índice simple para el campo 'id'
        ]

class StudentDocument(Document, StudentProfile):
    # Hereda todos los campos de StudentProfile
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "students"
        indexes = [
            "id",
        ]

class EvaluationDocument(Document, SegueEvaluation):
    # Hereda todos los campos de SegueEvaluation
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "evaluations"
        indexes = [
            "id",
            "encounter_id",
        ]

class EncounterDocument(Document):
    # Usamos Indexed como anotación de tipo aquí
    encounter_id: Indexed(str, unique=True)
    session_id: Optional[str] = None
    patient_id: str
    student_id: Optional[str] = None
    evaluator_name: Optional[str] = None
    mode: str = "free"
    chat_history: List[Dict[str, Any]] = []
    started_at: float = Field(default_factory=lambda: datetime.utcnow().timestamp())
    finished_at: Optional[float] = None
    doctor_submission: Optional[Dict[str, Any]] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Settings:
        name = "encounters"

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field
import time
import uuid

class PatientProfile(BaseModel):
    id: str = Field(..., description="Stable identifier (used by UI)")
    name: str
    age: int
    region: str = Field("AMBA", description="Region within Argentina")

    class TrueCaseReveal(BaseModel):
        diagnostico_principal: str
        diferenciales: List[str] = Field(default_factory=list)
        indicaciones_plan: str
        receta: Optional[str] = None

    class AdministrativeInfo(BaseModel):
        full_name: Optional[str] = None
        date_of_birth: Optional[str] = None
        dni: Optional[str] = None
        insurance: Optional[str] = None
        sex: Optional[str] = None
        occupation: Optional[str] = None

    class TriageInfo(BaseModel):
        reference_short: Optional[str] = None

    class ClinicalHistoryRecord(BaseModel):
        diagnoses: List[str] = Field(default_factory=list)
        surgeries: List[str] = Field(default_factory=list)
        allergies: List[str] = Field(default_factory=list)
        medications_current: List[str] = Field(default_factory=list)

    class RecentStudies(BaseModel):
        labs: List[str] = Field(default_factory=list)
        imaging: List[str] = Field(default_factory=list)
        notes: List[str] = Field(default_factory=list)

    administrative: AdministrativeInfo = Field(default_factory=AdministrativeInfo)
    triage: TriageInfo = Field(default_factory=TriageInfo)
    institutional_history: ClinicalHistoryRecord = Field(default_factory=ClinicalHistoryRecord)
    recent_studies: RecentStudies = Field(default_factory=RecentStudies)
    chief_complaint: str
    what_they_feel: str
    symptoms_reported: List[str] = Field(default_factory=list)
    known_medical_history: Dict[str, Any] = Field(default_factory=dict)
    unknown_real_problem: str
    doctor_display_real_problem: str
    true_case: Optional[TrueCaseReveal] = None
    personality: str = "Neutral"
    language_level: str = "B"
    medical_history_recall: str = "Low"
    cognitive_confusion: str = "Normal"
    speaking_style: str = "rioplatense"

class StudentProfile(BaseModel):
    id: str = Field(..., description="Stable identifier (used by UI)")
    name: str
    student_identifier: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)

class Message(BaseModel):
    role: str
    content: str
    timestamp: float = Field(default_factory=time.time)
    message_id: str = Field(default_factory=lambda: uuid.uuid4().hex)
    audio_url: Optional[str] = None

class AudioAsset(BaseModel):
    id: str = Field(default_factory=lambda: uuid.uuid4().hex)
    encounter_id: str
    content_type: str = "audio/wav"
    data_base64: str
    created_at: float = Field(default_factory=time.time)

class Encounter(BaseModel):
    encounter_id: str = Field(default_factory=lambda: uuid.uuid4().hex)
    patient_id: str
    student_id: Optional[str] = None
    evaluator_name: Optional[str] = None
    chat_history: List[Message] = Field(default_factory=list)
    started_at: float = Field(default_factory=time.time)
    finished_at: Optional[float] = None
    is_completed_successfully: bool = False
    metadata: Dict[str, Any] = Field(default_factory=dict)

class SegueEvaluationItem(BaseModel):
    id: str
    value: str = Field(..., pattern=r"^(yes|no|nc)$")
    notes: str = ""

class SegueEvaluation(BaseModel):
    id: str = Field(default_factory=lambda: uuid.uuid4().hex)
    encounter_id: str
    patient_id: str
    student_id: str
    student_name: str
    student_identifier: Optional[str] = None
    evaluator_name: str
    items: List[SegueEvaluationItem] = Field(default_factory=list)
    created_at: float = Field(default_factory=time.time)
    updated_at: float = Field(default_factory=time.time)

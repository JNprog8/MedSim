from typing import Any, Dict, List, Optional, Union
from pydantic import BaseModel, Field, field_validator
import time
import uuid

class PatientProfile(BaseModel):
    id: str = Field(..., description="Stable identifier (used by UI)")
    name: str
    last_name: str = ""
    age: int
    region: str = Field("AMBA", description="Region within Argentina")
    avatar: str = Field("male", description="Identifier for visual avatar (male/female)")
    voice: str = Field("es-AR-male-1", description="Identifier for TTS voice")

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

    class Symptom(BaseModel):
        name: str
        severity: int = Field(5, ge=1, le=10)
        duration_days: int = Field(1, ge=0)

    administrative: AdministrativeInfo = Field(default_factory=AdministrativeInfo)
    triage: TriageInfo = Field(default_factory=TriageInfo)
    institutional_history: ClinicalHistoryRecord = Field(default_factory=ClinicalHistoryRecord)
    recent_studies: RecentStudies = Field(default_factory=RecentStudies)
    chief_complaint: str
    what_they_feel: str
    spontaneous_info: Optional[str] = Field("", description="Información que el paciente revela voluntariamente o al inicio")
    conditional_info: Optional[str] = Field("", description="Información que solo revela si el estudiante le pregunta directamente")
    symptoms_reported: List[Symptom] = Field(default_factory=list)
    
    @field_validator('symptoms_reported', mode='before')
    @classmethod
    def parse_symptoms(cls, v):
        if not v:
            return []
        parsed = []
        for item in v:
            if isinstance(item, str):
                parsed.append({"name": item, "severity": 5, "duration_days": 1})
            elif isinstance(item, dict):
                parsed.append(item)
            else:
                parsed.append(item)
        return parsed

    known_medical_history: Dict[str, Any] = Field(default_factory=dict)
    unknown_real_problem: str
    doctor_display_real_problem: str
    true_case: Optional[TrueCaseReveal] = None
    personality: str = "Neutral"
    language_level: str = "B"
    medical_history_recall: str = "Low"
    cognitive_confusion: str = "Normal"
    speaking_style: str = "rioplatense"

    def to_student_view(self) -> Dict[str, Any]:
        """
        Tell: Genera una vista segura y filtrada para el estudiante.
        Encapsula qué información es pública y cuál privada.
        """
        public_fields = {
            "id": self.id,
            "name": self.name,
            "last_name": self.last_name,
            "age": self.age,
            "region": self.region,
            "avatar": self.avatar,
            "voice": self.voice,
            "chief_complaint": self.chief_complaint,
            "what_they_feel": self.what_they_feel,
            "symptoms_reported": [s.model_dump() for s in self.symptoms_reported],
        }
        
        # Inyectar sub-objetos serializados
        public_fields.update({
            "administrative": self.administrative.model_dump(),
            "triage": self.triage.model_dump(),
            "institutional_history": self.institutional_history.model_dump(),
            "recent_studies": self.recent_studies.model_dump(),
        })
        return public_fields

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

    def to_bytes(self) -> bytes:
        """
        Tell: Decodifica los datos base64 internamente.
        """
        import base64
        return base64.b64decode(self.data_base64)

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

    def add_message(self, role: str, content: str, audio_url: Optional[str] = None) -> Message:
        """
        Tell: Agrega un mensaje al historial interno.
        Encapsula la creación del objeto Message.
        """
        if self.finished_at is not None:
            raise ValueError("No se pueden añadir mensajes a un encuentro finalizado.")
        
        message = Message(role=role, content=content, audio_url=audio_url)
        self.chat_history.append(message)
        return message

    def get_llm_context(self) -> List[Dict[str, str]]:
        """
        Tell: Devuelve el historial en un formato compatible con LLMs.
        """
        return [{"role": m.role, "content": m.content} for m in self.chat_history]

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

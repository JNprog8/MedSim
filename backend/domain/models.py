from typing import Any, Dict, List, Literal, Optional, Union
from enum import Enum
from pydantic import BaseModel, Field, field_validator
import time
import uuid


class PatientSex(str, Enum):
    """
    Campo de sexo registrado en perfiles anteriores. Se conserva para
    compatibilidad; los casos nuevos separan birth_sex y self_reference.
    """
    MASCULINO = "masculino"
    FEMENINO = "femenino"
    OTRO = "otro"

    @classmethod
    def coerce(cls, value: Any) -> Optional["PatientSex"]:
        """
        Normaliza valores libres heredados ("Masculino", "M", "male", ...) al enum.
        Devuelve None si no hay dato cargado; cualquier valor no reconocido cae en OTRO.
        """
        if value is None:
            return None
        if isinstance(value, cls):
            return value
        raw = str(value).strip().lower()
        if not raw:
            return None
        if raw in _SEX_ALIASES_MASCULINO:
            return cls.MASCULINO
        if raw in _SEX_ALIASES_FEMENINO:
            return cls.FEMENINO
        return cls.OTRO


# Valores libres heredados que se mapean al enum (cargas viejas del formulario).
_SEX_ALIASES_MASCULINO = frozenset({
    "masculino", "masculine", "m", "male", "hombre", "varon", "varón", "h",
})
_SEX_ALIASES_FEMENINO = frozenset({
    "femenino", "femenina", "f", "female", "mujer",
})


class PatientProfile(BaseModel):
    id: str = Field(..., description="Stable identifier (used by UI)")
    name: str
    last_name: str = ""
    age: int
    region: str = Field("Bariloche, Río Negro, Argentina", description="Residencia fija del paciente dentro de Argentina")
    avatar: str = Field("male", description="Identifier for visual avatar (male/female)")
    voice: str = Field("1", description="Identifier for TTS voice")

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
        sex: Optional[PatientSex] = None
        birth_sex: Optional[Literal["masculino", "femenino", "intersexual", "no_especificado"]] = None
        occupation: Optional[str] = None

        @field_validator('sex', mode='before')
        @classmethod
        def normalize_sex(cls, v):
            return PatientSex.coerce(v)

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
    open_question_info: str = Field("", description="Información que aparece ante una pregunta abierta sobre el problema")
    conditional_info: Optional[str] = Field("", description="Información que solo revela si el estudiante le pregunta directamente")
    patient_concern: str = Field("", description="Preocupación o idea del paciente sobre lo que le ocurre")
    daily_impact: str = Field("", description="Impacto del problema en su vida cotidiana")
    visit_expectation: str = Field("", description="Qué espera de esta consulta")
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
    self_reference: Optional[Literal["masculino", "femenino", "neutral"]] = Field(
        None, description="Concordancia que usa el paciente al hablar de sí mismo"
    )

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
            # La anamnesis se obtiene conversando. Solo se entrega el motivo de triage.
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

    def get_llm_context(self, max_messages: int = 24) -> List[Dict[str, str]]:
        """
        Tell: Devuelve el historial en un formato compatible con LLMs,
        asegurando orden cronológico limpio, deduplicación de turnos consecutivos
        y evitando la saturación de tokens.
        """
        valid = [m for m in self.chat_history if m.content and m.content.strip()]
        if not valid:
            return []

        recent = valid[-max_messages:] if len(valid) > max_messages else valid

        collapsed: List[Dict[str, str]] = []
        for m in recent:
            cleaned_content = m.content.strip()
            if collapsed and collapsed[-1]["role"] == m.role:
                if cleaned_content not in collapsed[-1]["content"]:
                    collapsed[-1]["content"] += f"\n{cleaned_content}"
            else:
                collapsed.append({"role": m.role, "content": cleaned_content})

        return collapsed

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

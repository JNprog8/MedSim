import json
from typing import List
from backend.domain.models import PatientProfile

class PromptService:
    def _doctor_treatment(self, profile: PatientProfile) -> str:
        try:
            if int(profile.age) >= 55:
                return "usted"
        except:
            pass
        return "vos"

    def _dialect_hints(self, profile: PatientProfile) -> str:
        style = (profile.speaking_style or "").strip().lower()
        region = (profile.region or "").strip() or "Argentina"
        if "cordob" in style:
            return f"Hablas en argentino con un toque cordobés (sutil). Usa voseo y muletillas como 'che' o 'un toque'."
        return f"Hablas en español rioplatense/argentino (Región: {region}). Usa voseo (tenés/estás/sos) de forma natural."

    def build_patient_system_prompt(self, profile: PatientProfile) -> str:
        symptoms = "\n".join([f"- {item}" for item in (profile.symptoms_reported or [])]) or "- (no especificado)"
        
        return f"""
Sos un/a paciente en una Guardia / Emergencias.
PERSONAJE:
- Nombre: {profile.name}, Edad: {profile.age}
- Personalidad: {profile.personality}, Estilo: {profile.speaking_style}
- Trato al médico: usa "{self._doctor_treatment(profile)}".
- Dialecto: {self._dialect_hints(profile)}

PRESENTACIÓN: {profile.chief_complaint}
LO QUE SENTÍS: {profile.what_they_feel}
SÍNTOMAS: {symptoms}
PROBLEMA REAL (SECRETO): {profile.unknown_real_problem} (No lo nombres directamente)

REGLAS:
- Actúa SOLO como paciente.
- Responde SIEMPRE en español argentino (voseo: tenés, estás, sos).
- Respuestas CORTAS (1-4 frases).
- Si no sabés algo, decilo. No inventes datos médicos.
""".strip()

from __future__ import annotations

import json

from ..domain.models import PatientProfile


class PromptService:
    def _doctor_treatment(self, profile: PatientProfile) -> str:
        """How the patient addresses the clinician.

        In Argentina, many older patients default to "usted" with clinicians.
        """

        try:
            if int(profile.age) >= 55:
                return "usted"
        except Exception:
            pass
        return "vos"

    def _dialect_hints(self, profile: PatientProfile) -> str:
        style = (profile.speaking_style or "").strip().lower()
        region = (profile.region or "").strip() or "Argentina"

        # Keep it subtle and non-stereotyped; prioritize broadly Argentine/Rioplatense features.
        if "cordob" in style:
            return (
                f"Hablas en argentino con un toque cordobes (muy sutil). Region: {region}. "
                "Usa voseo (tenes/estas/sos) y alguna muletilla ocasional ('che', 'mira', 'un toque')."
            )
        if "cuy" in style:
            return (
                f"Hablas en argentino con un toque cuyano (muy sutil). Region: {region}. "
                "Usa voseo (tenes/estas/sos) y alguna muletilla ocasional ('che', 'mira', 'la verdad')."
            )
        return (
            f"Hablas en espanol rioplatense/argentino. Region: {region}. "
            "Usa voseo (tenes/estas/sos) y muletillas suaves de manera natural."
        )

    def build_patient_system_prompt(self, profile: PatientProfile) -> str:
        known = json.dumps(profile.known_medical_history, ensure_ascii=False, indent=2)
        symptoms = "\n".join([f"- {item}" for item in (profile.symptoms_reported or [])]) or "- (no especificado)"
        inst = profile.institutional_history.model_dump()
        studies = profile.recent_studies.model_dump()
        institutional_record = json.dumps(
            {
                "diagnosticos_previos": inst.get("diagnoses", []),
                "cirugias_previas": inst.get("surgeries", []),
                "alergias": inst.get("allergies", []),
                "medicacion_actual": inst.get("medications_current", []),
                "estudios_recientes": studies,
            },
            ensure_ascii=False,
            indent=2,
        )

        doctor_treatment = self._doctor_treatment(profile)
        dialect_hints = self._dialect_hints(profile)

        return f"""
Sos un/a paciente en una Guardia / Emergencias.

PERSONAJE:
- Personalidad: {profile.personality}
- Nivel de idioma: {profile.language_level}
- Memoria de antecedentes: {profile.medical_history_recall}
- Confusion cognitiva: {profile.cognitive_confusion}
- Estilo de habla: {profile.speaking_style}
- Trato al/la medico/a: usa \"{doctor_treatment}\" (si corresponde por edad/registro).
- Guia de dialecto: {dialect_hints}

TU PRESENTACION INICIAL:
{profile.chief_complaint}

LO QUE SENTIS:
{profile.what_they_feel}

SINTOMAS QUE CONTAS:
{symptoms}

DATOS MEDICOS QUE SI SABES:
{known}

HISTORIA CLINICA DE LA INSTITUCION:
{institutional_record}
REGLAS SOBRE ESTO:
- Si el/la medico/a pregunta por algo de la historia clinica, contesta segun tu memoria.
- Si algo figura en el sistema pero no lo recordas, deci que no estas seguro/a.
- No saques estudios o laboratorios por tu cuenta salvo que te pregunten.

PROBLEMA REAL SECRETO:
- {profile.unknown_real_problem}
No lo nombres ni lo adivines en voz alta.

REGLAS GENERALES:
- Actua SOLO como paciente.
- Responde SIEMPRE en espanol argentino (rioplatense por defecto).
- Usa voseo correctamente (ej.: \"tenes\", \"estas\", \"sos\", \"podes\", \"queres\", \"venis\").
- Usa 0 a 2 muletillas argentinas por respuesta, sin caricaturizar (ej.: \"che\", \"mira\", \"la verdad\", \"un toque\", \"medio\", \"viste\", \"dale\").
- Evita regionalismos de Espana (\"vale\", \"vosotros\", \"tio\") y un neutro excesivo; manten registro de guardia en Argentina.
- Manten las respuestas cortas: 1 a 4 frases, maximo 70 palabras.
- No inventes informacion nueva. Si no sabes algo, decilo.
- No inventes datos objetivos salvo que el/la medico/a los haya dicho explicitamente.
- Contesta como una persona real en una consulta.
""".strip()

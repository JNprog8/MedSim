from typing import Dict, List, Optional
from backend.domain.models import PatientProfile

class PatientFactory:
    """
    Spec Definition: Factory para la creación de perfiles de paciente.
    Aísla la lógica de parsing y validación del formulario.
    """

    @staticmethod
    def build_from_form(payload: Dict) -> PatientProfile:
        """
        Implementation: Transforma el payload del frontend en un objeto de dominio.
        """
        first_name = str(payload.get("first_name") or payload.get("name") or "").strip()
        last_name = str(payload.get("last_name") or "").strip()
        full_name = " ".join(part for part in [first_name, last_name] if part).strip() or first_name
        patient_id = str(payload.get("id") or "").strip()
        
        try:
            age = int(payload.get("age", 0))
        except ValueError:
            age = 0

        def split_lines(value: Optional[str]) -> List[str]:
            return [
                item.strip()
                for item in str(value or "").splitlines()
                if item.strip()
            ]

        def parse_key_value_lines(value: Optional[str]) -> Dict[str, str]:
            parsed: Dict[str, str] = {}
            for line in split_lines(value):
                if ":" not in line:
                    continue
                key, raw_value = line.split(":", 1)
                key = key.strip()
                normalized_value = raw_value.strip()
                if key:
                    parsed[key] = normalized_value
            return parsed

        chief_complaint = str(payload.get("chief_complaint") or "").strip() or "Hola, doc. Vine a la guardia."
        triage_short = str(payload.get("triage_short") or "").strip() or chief_complaint[:70]
        
        true_main = str(payload.get("true_main") or "").strip()
        true_plan = str(payload.get("true_plan") or "").strip()
        true_rx = str(payload.get("true_rx") or "").strip()
        differentials = split_lines(payload.get("true_differentials_text"))

        true_case = None
        if true_main or true_plan or differentials or true_rx:
            true_case = PatientProfile.TrueCaseReveal(
                diagnostico_principal=true_main or "(Completar)",
                diferenciales=differentials,
                indicaciones_plan=true_plan or "(Completar)",
                receta=true_rx or None,
            )

        return PatientProfile(
            id=patient_id,
            name=first_name or full_name or patient_id,
            age=age,
            region=str(payload.get("region") or "AMBA").strip() or "AMBA",
            administrative=PatientProfile.AdministrativeInfo(
                full_name=full_name or first_name or None,
                date_of_birth=str(payload.get("date_of_birth") or "").strip() or None,
                dni=str(payload.get("dni") or "").strip() or None,
                insurance=str(payload.get("insurance") or "").strip() or None,
                sex=str(payload.get("sex") or "").strip() or None,
                occupation=str(payload.get("occupation") or "").strip() or None,
            ),
            triage=PatientProfile.TriageInfo(reference_short=triage_short or None),
            institutional_history=PatientProfile.ClinicalHistoryRecord(
                diagnoses=split_lines(payload.get("diagnoses_text")),
                surgeries=split_lines(payload.get("surgeries_text")),
                allergies=split_lines(payload.get("allergies_text")),
                medications_current=split_lines(payload.get("medications_text")),
            ),
            recent_studies=PatientProfile.RecentStudies(
                labs=split_lines(payload.get("labs_text")),
                imaging=split_lines(payload.get("imaging_text")),
                notes=split_lines(payload.get("notes_text")),
            ),
            chief_complaint=chief_complaint,
            what_they_feel=str(payload.get("what_they_feel") or "").strip() or "Me siento mal.",
            symptoms_reported=split_lines(payload.get("symptoms_text")),
            known_medical_history=parse_key_value_lines(payload.get("known_history_text")),
            unknown_real_problem=str(payload.get("unknown_real_problem") or "(Completar)").strip() or "(Completar)",
            doctor_display_real_problem=str(payload.get("doctor_display_real_problem") or "(Completar)").strip() or "(Completar)",
            true_case=true_case,
            personality=str(payload.get("personality") or "Neutral").strip() or "Neutral",
            language_level=str(payload.get("language_level") or "B").strip() or "B",
            medical_history_recall=str(payload.get("medical_history_recall") or "Low").strip() or "Low",
            cognitive_confusion=str(payload.get("cognitive_confusion") or "Normal").strip() or "Normal",
            speaking_style=str(payload.get("speaking_style") or "rioplatense").strip() or "rioplatense",
        )

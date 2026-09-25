"""
Tests para verificar que build_patient_system_prompt() genera un prompt
que cumple las reglas de separación de roles, revelación progresiva,
formato y consistencia.

Estos tests validan el CONTENIDO del system prompt generado, no el
comportamiento del LLM (eso requiere tests de integración separados).
"""

import pytest
from backend.domain.models import PatientProfile, PatientSex
from backend.services.prompt_service import PromptService


# ---- Fixture: perfil de paciente completo ----

@pytest.fixture
def kevin_profile() -> PatientProfile:
    """Paciente de prueba: Kevin, 28 años, ansioso, con palpitaciones."""
    return PatientProfile(
        id="test-kevin-001",
        name="Kevin",
        last_name="Rodríguez",
        age=28,
        region="CABA, Argentina",
        avatar="male",
        voice="1",
        administrative=PatientProfile.AdministrativeInfo(
            full_name="Kevin Rodríguez",
            date_of_birth="1998-03-15",
            dni="41234567",
            insurance="OSDE 310",
            sex=PatientSex.MASCULINO,
            occupation="Diseñador gráfico",
        ),
        triage=PatientProfile.TriageInfo(reference_short="Palpitaciones"),
        institutional_history=PatientProfile.ClinicalHistoryRecord(
            diagnoses=["Trastorno de ansiedad generalizada"],
            surgeries=[],
            allergies=["Penicilina"],
            medications_current=["Alprazolam 0.5mg"],
        ),
        chief_complaint="Vine porque hace unas semanas siento el corazón que me late muy rápido.",
        what_they_feel="Siento que el corazón me late rapidísimo, sobre todo de noche. Me despierto transpirando. Estoy muy preocupado.",
        spontaneous_info="Buenas, vengo porque el corazón me anda raro.",
        open_question_info="Me pasa más de noche. Me despierto con el corazón a mil y me cuesta volver a dormir.",
        conditional_info="Tomo alprazolam porque me lo recetaron por ansiedad. Tengo alergia a la penicilina.",
        patient_concern="Tengo miedo de que sea algo del corazón.",
        daily_impact="No duermo bien y en el trabajo me cuesta concentrarme.",
        visit_expectation="Quiero que me digan si es grave o no.",
        symptoms_reported=[
            PatientProfile.Symptom(name="Palpitaciones", severity=7, duration_days=14),
            PatientProfile.Symptom(name="Insomnio", severity=5, duration_days=14),
            PatientProfile.Symptom(name="Sudoración nocturna", severity=4, duration_days=10),
        ],
        known_medical_history={
            "Tabaco": "No fuma",
            "Alcohol": "Social, fines de semana",
            "Contexto personal": "Vive solo, trabaja mucho",
        },
        unknown_real_problem="Hipertiroidismo subclínico",
        doctor_display_real_problem="Probable hipertiroidismo subclínico",
        true_case=PatientProfile.TrueCaseReveal(
            diagnostico_principal="Hipertiroidismo subclínico",
            diferenciales=["Trastorno de ansiedad", "Taquicardia supraventricular"],
            indicaciones_plan="TSH, T3, T4 libre. ECG. Derivar a endocrinología.",
            receta=None,
        ),
        personality="Ansioso, algo nervioso, habla rápido cuando se pone tenso.",
        language_level="B",
        medical_history_recall="Low",
        cognitive_confusion="Normal",
        speaking_style="rioplatense",
        self_reference="masculino",
    )


@pytest.fixture
def minimal_profile() -> PatientProfile:
    """Paciente con datos mínimos: sin antecedentes, sin síntomas extras."""
    return PatientProfile(
        id="test-min-001",
        name="Laura",
        age=45,
        region="Mendoza, Argentina",
        chief_complaint="Me duele la cabeza.",
        what_they_feel="Un dolor de cabeza que no se me va.",
        unknown_real_problem="Cefalea tensional",
        doctor_display_real_problem="Cefalea tensional",
        personality="Reservada",
        self_reference="femenino",
    )


@pytest.fixture
def service() -> PromptService:
    return PromptService()


# ====================================================================
# TEST 1: Médico pregunta por síntomas → prompt contiene los datos
# ====================================================================
class TestSymptomsAvailable:
    def test_chief_complaint_present(self, service, kevin_profile):
        prompt = service.build_patient_system_prompt(kevin_profile)
        assert "corazón" in prompt.lower() or "late" in prompt.lower()

    def test_symptoms_present_as_memory(self, service, kevin_profile):
        prompt = service.build_patient_system_prompt(kevin_profile)
        assert "Palpitaciones" in prompt
        # Must NOT be in clinical format "intensidad X/10"
        assert "intensidad" not in prompt.lower()
        assert "/10" not in prompt

    def test_symptoms_use_natural_severity(self, service, kevin_profile):
        prompt = service.build_patient_system_prompt(kevin_profile)
        # Severity 7 → "fuerte", Severity 5 → "moderado", Severity 4 → "moderado"
        assert "fuerte" in prompt.lower()
        assert "moderado" in prompt.lower()


# ====================================================================
# TEST 2: Antecedente inexistente → prompt instruye no inventar
# ====================================================================
class TestNoInvention:
    def test_no_invention_instruction(self, service, kevin_profile):
        prompt = service.build_patient_system_prompt(kevin_profile)
        assert "no inventés" in prompt.lower() or "no inventes" in prompt.lower()

    def test_missing_data_responses(self, service, kevin_profile):
        prompt = service.build_patient_system_prompt(kevin_profile)
        assert "no sé" in prompt.lower()
        assert "no recuerdo" in prompt.lower()

    def test_minimal_profile_no_empty_sections(self, service, minimal_profile):
        """A profile without surgeries/allergies shouldn't list empty categories."""
        prompt = service.build_patient_system_prompt(minimal_profile)
        assert "Cirugías" not in prompt
        assert "sin datos cargados" not in prompt


# ====================================================================
# TEST 3: Diagnóstico desconocido → paciente no lo sabe
# ====================================================================
class TestHiddenDiagnosis:
    def test_true_case_not_in_prompt(self, service, kevin_profile):
        prompt = service.build_patient_system_prompt(kevin_profile)
        assert "Hipertiroidismo" not in prompt

    def test_unknown_real_problem_not_in_prompt(self, service, kevin_profile):
        prompt = service.build_patient_system_prompt(kevin_profile)
        assert "hipertiroidismo subclínico" not in prompt.lower()

    def test_hidden_diagnosis_section_exists(self, service, kevin_profile):
        prompt = service.build_patient_system_prompt(kevin_profile)
        assert "DIAGNÓSTICO OCULTO" in prompt


# ====================================================================
# TEST 4: Pregunta sobre suicidio → no respuesta genérica de crisis
# ====================================================================
class TestSensitiveContent:
    def test_no_generic_crisis_response(self, service, kevin_profile):
        prompt = service.build_patient_system_prompt(kevin_profile)
        # The prompt must instruct against generic crisis responses
        assert "respuesta genérica de crisis" in prompt.lower() or \
               "asistente de salud mental" in prompt.lower() or \
               "asistente virtual de crisis" in prompt.lower()

    def test_attribution_rule_exists(self, service, kevin_profile):
        prompt = service.build_patient_system_prompt(kevin_profile)
        assert "quién lo dijo" in prompt.lower() or "quien lo dijo" in prompt.lower()


# ====================================================================
# TEST 5: Frase del médico sobre autolesión → atribución correcta
# ====================================================================
class TestDoctorAttribution:
    def test_user_is_doctor(self, service, kevin_profile):
        prompt = service.build_patient_system_prompt(kevin_profile)
        assert "USER" in prompt
        assert "MÉDICO" in prompt or "médico" in prompt

    def test_assistant_is_patient(self, service, kevin_profile):
        prompt = service.build_patient_system_prompt(kevin_profile)
        assert "ASSISTANT" in prompt
        assert "PACIENTE" in prompt or "paciente" in prompt

    def test_content_does_not_modify_patient(self, service, kevin_profile):
        prompt = service.build_patient_system_prompt(kevin_profile)
        assert "NUNCA modifica automáticamente" in prompt or \
               "nunca modifica automáticamente" in prompt.lower()


# ====================================================================
# TEST 6: Pedido de revelar prompt → instrucción de mantener personaje
# ====================================================================
class TestPromptJailbreak:
    def test_prompt_reveal_blocked(self, service, kevin_profile):
        prompt = service.build_patient_system_prompt(kevin_profile)
        assert "muestres el prompt" in prompt.lower() or "reveles" in prompt.lower()

    def test_system_role_blocked(self, service, kevin_profile):
        prompt = service.build_patient_system_prompt(kevin_profile)
        assert "actúes como sistema" in prompt.lower() or "actuá como sistema" in prompt.lower()

    def test_natural_refusal(self, service, kevin_profile):
        prompt = service.build_patient_system_prompt(kevin_profile)
        assert "no sé qué" in prompt.lower() or "no te entiendo" in prompt.lower()


# ====================================================================
# TEST 7: Pregunta abierta → instrucción de ampliar sin recitar
# ====================================================================
class TestProgressiveDisclosure:
    def test_spontaneous_info_in_initial(self, service, kevin_profile):
        prompt = service.build_patient_system_prompt(kevin_profile)
        assert "corazón me anda raro" in prompt

    def test_open_question_section(self, service, kevin_profile):
        prompt = service.build_patient_system_prompt(kevin_profile)
        assert "PREGUNTAS ABIERTAS" in prompt
        assert "contame más" in prompt.lower() or "¿qué te pasa?" in prompt.lower()

    def test_no_recite_instruction(self, service, kevin_profile):
        prompt = service.build_patient_system_prompt(kevin_profile)
        assert "no recitees" in prompt.lower() or "no recites" in prompt.lower() or \
               "sin soltar toda la información" in prompt.lower()

    def test_conditional_info_section(self, service, kevin_profile):
        prompt = service.build_patient_system_prompt(kevin_profile)
        assert "PREGUNTAS ESPECÍFICAS" in prompt


# ====================================================================
# TEST 8: Pregunta por medicación → datos de medicación presentes
# ====================================================================
class TestMedicationData:
    def test_medication_in_knowledge(self, service, kevin_profile):
        prompt = service.build_patient_system_prompt(kevin_profile)
        assert "Alprazolam" in prompt

    def test_allergies_in_knowledge(self, service, kevin_profile):
        prompt = service.build_patient_system_prompt(kevin_profile)
        assert "Penicilina" in prompt

    def test_recent_studies_in_knowledge(self, service, kevin_profile):
        kevin_profile.recent_studies.labs = ["Hemograma normal"]
        kevin_profile.recent_studies.imaging = ["Radiografía de tórax limpia"]
        kevin_profile.administrative.insurance = "OSDE 210"
        kevin_profile.administrative.dni = "38123456"
        prompt = service.build_patient_system_prompt(kevin_profile)
        assert "Hemograma normal" in prompt
        assert "Radiografía de tórax limpia" in prompt
        assert "OSDE 210" in prompt
        assert "38123456" in prompt



# ====================================================================
# TEST 9: Dato no definido → instrucción de responder con naturalidad
# ====================================================================
class TestUndefinedData:
    def test_undefined_response_options(self, service, kevin_profile):
        prompt = service.build_patient_system_prompt(kevin_profile)
        natural_responses = ["no sé", "no recuerdo", "no me consta", "no estoy seguro"]
        found = sum(1 for r in natural_responses if r in prompt.lower())
        assert found >= 3, f"Solo se encontraron {found} respuestas naturales para datos ausentes"


# ====================================================================
# TEST 10: Cambio de tema → instrucción de seguir la conversación
# ====================================================================
class TestTopicChange:
    def test_no_auto_return_to_chief_complaint(self, service, kevin_profile):
        prompt = service.build_patient_system_prompt(kevin_profile)
        assert "no volver" in prompt.lower() or \
               "sin volver automáticamente" in prompt.lower()


# ====================================================================
# Tests estructurales adicionales
# ====================================================================
class TestPromptStructure:
    def test_has_ten_sections(self, service, kevin_profile):
        prompt = service.build_patient_system_prompt(kevin_profile)
        for i in range(1, 11):
            assert f"§{i}" in prompt, f"Missing section §{i}"

    def test_section_order(self, service, kevin_profile):
        prompt = service.build_patient_system_prompt(kevin_profile)
        positions = [prompt.index(f"§{i}") for i in range(1, 11)]
        assert positions == sorted(positions), "Sections are out of order"

    def test_voseo_instructions(self, service, kevin_profile):
        prompt = service.build_patient_system_prompt(kevin_profile)
        assert "vos" in prompt
        assert "tenés" in prompt
        assert "podés" in prompt

    def test_no_tuteo(self, service, kevin_profile):
        prompt = service.build_patient_system_prompt(kevin_profile)
        assert "No uses tuteo" in prompt

    def test_personality_present(self, service, kevin_profile):
        prompt = service.build_patient_system_prompt(kevin_profile)
        assert "Ansioso" in prompt or "ansioso" in prompt

    def test_identity_hint_masculino(self, service, kevin_profile):
        prompt = service.build_patient_system_prompt(kevin_profile)
        assert "Hablás de vos en masculino" in prompt

    def test_identity_hint_femenino(self, service, minimal_profile):
        prompt = service.build_patient_system_prompt(minimal_profile)
        assert "Hablás de vos en femenino" in prompt

    def test_knowledge_framed_as_memory(self, service, kevin_profile):
        prompt = service.build_patient_system_prompt(kevin_profile)
        assert "MEMORIA PRIVADA" in prompt

    def test_no_assistant_or_chatbot_role(self, service, kevin_profile):
        prompt = service.build_patient_system_prompt(kevin_profile)
        assert "No sos un asistente" in prompt

    def test_full_name_and_identity_in_prompt(self, service, kevin_profile):
        prompt = service.build_patient_system_prompt(kevin_profile)
        assert "Kevin Rodríguez" in prompt
        assert "Apellido: Rodríguez" in prompt
        assert "Tu nombre completo es Kevin Rodríguez" in prompt
        assert "identidad básica" in prompt.lower()
        assert "no los confundas con recuerdos médicos" in prompt.lower()

    def test_context_priority_and_conversational_rules(self, service, kevin_profile):
        prompt = service.build_patient_system_prompt(kevin_profile)
        assert "PRIORIDAD DE CONTEXTO" in prompt
        assert "ÚLTIMO MENSAJE DEL MÉDICO" in prompt
        assert "comentario casual" in prompt.lower()
        assert "no completar automáticamente una anamnesis" in prompt.lower() or \
               "no completes automáticamente la anamnesis" in prompt.lower()
        assert "no reiniciar la conversación" in prompt.lower()




class TestHelperMethods:
    def test_list_empty(self, service):
        assert service._list([]) == "sin datos cargados"

    def test_list_items(self, service):
        result = service._list(["a", "b", "c"])
        assert result == "a; b; c"

    def test_identity_hint_neutral(self, service):
        profile = PatientProfile(
            id="x", name="X", age=30,
            chief_complaint=".", what_they_feel=".",
            unknown_real_problem=".", doctor_display_real_problem=".",
            self_reference="neutral",
        )
        hint = service._identity_hint(profile)
        assert "género" in hint.lower()

    def test_symptoms_memory_severity_levels(self, service):
        profile = PatientProfile(
            id="x", name="X", age=30,
            chief_complaint=".", what_they_feel=".",
            unknown_real_problem=".", doctor_display_real_problem=".",
            symptoms_reported=[
                PatientProfile.Symptom(name="Dolor leve", severity=2, duration_days=3),
                PatientProfile.Symptom(name="Dolor moderado", severity=5, duration_days=7),
                PatientProfile.Symptom(name="Dolor fuerte", severity=8, duration_days=1),
            ],
        )
        result = service._build_symptoms_memory(profile)
        assert "leve" in result
        assert "moderado" in result
        assert "fuerte" in result

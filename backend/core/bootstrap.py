import time
import logging

from backend.domain.models import Encounter, PatientProfile, StudentProfile
from backend.services.container import services

logger = logging.getLogger(__name__)


DEMO_PATIENT = PatientProfile(
    id="lucas_21_apendicitis_demo",
    name="Lucas",
    last_name="Fernandez",
    age=21,
    region="AMBA",
    avatar="male",
    voice="es-AR-male-1",

    administrative=PatientProfile.AdministrativeInfo(
        full_name="Lucas Fernandez",
        date_of_birth="2005-03-18",
        dni="45123456",
        insurance="OSDE",
        sex="Masculino",
        occupation="Estudiante universitario",
    ),

    triage=PatientProfile.TriageInfo(
        reference_short="Dolor abdominal intenso desde ayer"
    ),

    institutional_history=PatientProfile.ClinicalHistoryRecord(
        diagnoses=["Amigdalitis aguda repetitiva en la infancia"],
        surgeries=["Sin cirugías previas"],
        allergies=["Sin alergias medicamentosas conocidas (NKDA)"],
        medications_current=["Ibuprofeno 400 mg ocasional por dolores ocasionales"],
    ),

    recent_studies=PatientProfile.RecentStudies(
        labs=[
            "Leucocitos: 15.200/mm3",
            "Neutrófilos: 86%",
            "PCR: 12 mg/dL",
            "Hemoglobina: 14,8 g/dL",
        ],
        imaging=[
            "Ecografía abdominal: apéndice aumentado de diámetro, "
            "no compresible, con signos inflamatorios compatibles "
            "con apendicitis aguda."
        ],
        notes=[
            "Paciente consulta por dolor abdominal de aproximadamente "
            "24 horas de evolución.",
            "Dolor inicialmente periumbilical con posterior migración "
            "a fosa ilíaca derecha.",
            "Refiere náuseas, fiebre y pérdida de apetito.",
        ],
    ),

    chief_complaint=(
        "Doctor, me duele muchísimo la panza desde ayer "
        "y cada vez se me hace más difícil aguantar el dolor."
    ),

    what_they_feel=(
        "Tengo un dolor fuerte en la panza. Al principio me dolía "
        "cerca del ombligo, pero después se fue para el lado derecho "
        "y ahora me duele bastante cuando camino o me muevo. "
        "También tengo un poco de fiebre, náuseas y no tengo ganas de comer."
    ),

    spontaneous_info=(
        "El dolor empezó ayer alrededor del ombligo. "
        "Al principio pensé que era algo que había comido, "
        "pero después el dolor se fue hacia la parte baja derecha "
        "de la panza y se hizo más fuerte. Desde entonces tengo "
        "náuseas, estoy medio decaído y tuve algo de fiebre."
    ),

    conditional_info=(
        "El dolor empeora cuando camino, toso o hago movimientos bruscos. "
        "No tuve diarrea. No tuve vómitos. No recuerdo haber comido nada "
        "fuera de lo normal. No tengo enfermedades importantes conocidas. "
        "Nunca me operaron y no tomo medicamentos habitualmente."
    ),

    symptoms_reported=[
        PatientProfile.Symptom(
            name="Dolor abdominal",
            severity=8,
            duration_days=1,
        ),
        PatientProfile.Symptom(
            name="Náuseas",
            severity=6,
            duration_days=1,
        ),
        PatientProfile.Symptom(
            name="Fiebre",
            severity=5,
            duration_days=1,
        ),
        PatientProfile.Symptom(
            name="Pérdida de apetito",
            severity=6,
            duration_days=1,
        ),
    ],

    known_medical_history={
        "antecedentes_medicos": "Ninguno conocido",
        "antecedentes_familiares": "Sin antecedentes relevantes conocidos",
        "tabaquismo": "No fuma",
        "alcohol": "Consumo ocasional",
        "alimentacion_reciente": "Sin cambios ni alimentos inusuales",
    },

    unknown_real_problem=(
        "Inflamación aguda del apéndice compatible con apendicitis aguda."
    ),

    doctor_display_real_problem=(
        "Dolor abdominal agudo en evaluación."
    ),

    true_case=PatientProfile.TrueCaseReveal(
        diagnostico_principal="Apendicitis aguda",
        diferenciales=[
            "Gastroenteritis",
            "Cólico renal",
            "Diverticulitis",
            "Adenitis mesentérica",
        ],
        indicaciones_plan=(
            "Evaluación quirúrgica. Realizar examen abdominal, "
            "hemograma, marcadores inflamatorios e imagen abdominal "
            "según criterio clínico. Mantener vigilancia clínica "
            "y valorar resolución quirúrgica."
        ),
        receta=(
            "No corresponde manejo ambulatorio. Requiere valoración "
            "hospitalaria y eventual tratamiento quirúrgico."
        ),
    ),

    personality="Ansioso",
    language_level="A",
    medical_history_recall="High",
    cognitive_confusion="Normal",
    speaking_style="rioplatense",
)


DEMO_STUDENT = StudentProfile(
    id="40909342",
    name="Heraldo Basualdo",
    student_identifier="40909342",
    metadata={"source": "bootstrap_demo"},
)


DEMO_ENCOUNTER_ID = "enc_demo_activo"


async def bootstrap_demo_data():
    """
    Asegura que existan datos de prueba iniciales en la DB.
    Usa el ServiceContainer para desacoplar la persistencia.
    """

    await services.patient_repo.upsert(DEMO_PATIENT)

    logger.info(
        f"Paciente demo asegurado: "
        f"{DEMO_PATIENT.name} {DEMO_PATIENT.last_name}"
    )

    await services.student_repo.upsert(DEMO_STUDENT)

    logger.info(
        f"Alumno demo asegurado: {DEMO_STUDENT.name}"
    )

    try:
        existing_encounter = await services.encounter_repo.get_by_id(
            DEMO_ENCOUNTER_ID,
            id_field="encounter_id",
        )
    except Exception:
        existing_encounter = None

    if existing_encounter:
        existing_encounter.patient_id = DEMO_PATIENT.id
        existing_encounter.student_id = DEMO_STUDENT.id
        existing_encounter.finished_at = None
        existing_encounter.is_completed_successfully = False

        existing_encounter.metadata = {
            **(existing_encounter.metadata or {}),
            "source": "bootstrap_demo",
            "auto_active": True,
        }

        await services.encounter_repo.upsert(
            existing_encounter,
            id_field="encounter_id",
        )

        logger.info(
            f"Encounter demo reactivado: "
            f"{existing_encounter.encounter_id}"
        )

        return

    demo_encounter = Encounter(
        encounter_id=DEMO_ENCOUNTER_ID,
        patient_id=DEMO_PATIENT.id,
        student_id=DEMO_STUDENT.id,
        evaluator_name="Demo Evaluador",
        started_at=time.time(),
        finished_at=None,
        is_completed_successfully=False,
        metadata={
            "source": "bootstrap_demo",
            "auto_active": True,
        },
    )

    await services.encounter_repo.upsert(
        demo_encounter,
        id_field="encounter_id",
    )

    logger.info(
        f"Encounter demo creado: "
        f"{demo_encounter.encounter_id}"
    )
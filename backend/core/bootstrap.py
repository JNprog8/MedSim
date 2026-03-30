import time

from backend.domain.models import Encounter, PatientProfile, StudentProfile
from backend.persistence.encounter_repository import EncounterRepository
from backend.persistence.patient_repository import PatientRepository
from backend.persistence.student_repository import StudentRepository


DEMO_PATIENT = PatientProfile(
    id="jorge_62_dolor_pecho_demo",
    name="Jorge",
    age=62,
    region="AMBA",
    administrative=PatientProfile.AdministrativeInfo(
        full_name="Jorge Ramirez",
        date_of_birth="1963-08-14",
        dni="22123456",
        insurance="PAMI",
        sex="Masculino",
        occupation="Jubilado",
    ),
    triage=PatientProfile.TriageInfo(
        reference_short="Presion en el pecho desde hace un rato + ansiedad"
    ),
    institutional_history=PatientProfile.ClinicalHistoryRecord(
        diagnoses=["Hipertension arterial", "Dislipidemia"],
        surgeries=["Apendicectomia"],
        allergies=["Penicilina"],
        medications_current=["Losartan 50 mg por dia", "Atorvastatina 20 mg por dia"],
    ),
    recent_studies=PatientProfile.RecentStudies(
        labs=["Glucemia 108 mg/dL", "Colesterol total 228 mg/dL"],
        imaging=["Rx de torax sin hallazgos agudos (hace 8 meses)"],
        notes=["Consulta previa por dolor toracico atipico."],
    ),
    chief_complaint="Doctor, me agarra como una presion en el pecho desde hace un rato y me asuste.",
    what_they_feel="Siento una presion en el pecho, estoy nervioso y no se me termina de pasar.",
    symptoms_reported=["Presion en el pecho", "Ansiedad", "Sudoracion leve", "Sensacion de alarma"],
    known_medical_history={
        "tabaquismo": "Ex fumador, dejo hace 10 anos",
        "antecedentes_familiares": "Padre con infarto a los 67 anos",
    },
    unknown_real_problem="Dolor toracico compatible con sindrome coronario agudo a descartar.",
    doctor_display_real_problem="Dolor precordial en evaluacion.",
    true_case=PatientProfile.TrueCaseReveal(
        diagnostico_principal="Sindrome coronario agudo",
        diferenciales=["Angina inestable", "Crisis de ansiedad", "ERGE"],
        indicaciones_plan="Evaluacion urgente, ECG, troponinas seriadas, monitoreo y derivacion a guardia.",
        receta="Aspirina segun criterio clinico y manejo hospitalario.",
    ),
    personality="Ansioso",
    language_level="B",
    medical_history_recall="Low",
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
    patient_repo = PatientRepository()
    student_repo = StudentRepository()
    encounter_repo = EncounterRepository()

    await patient_repo.upsert(DEMO_PATIENT)
    print(f"Paciente demo asegurado: {DEMO_PATIENT.name} ({DEMO_PATIENT.id})")

    await student_repo.upsert(DEMO_STUDENT)
    print(f"Alumno demo asegurado: {DEMO_STUDENT.name} ({DEMO_STUDENT.id})")

    existing_encounter = await encounter_repo.get_by_encounter_id(DEMO_ENCOUNTER_ID)
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
        await encounter_repo.upsert(existing_encounter, id_field="encounter_id")
        print(f"Encounter demo reactivado: {existing_encounter.encounter_id}")
    else:
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
        await encounter_repo.upsert(demo_encounter, id_field="encounter_id")
        print(f"Encounter demo creado: {demo_encounter.encounter_id}")

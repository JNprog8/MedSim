import json
from pathlib import Path
from backend.core.config import settings
from backend.domain.models import PatientProfile, StudentProfile
from backend.persistence.patient_repository import PatientRepository
from backend.persistence.student_repository import StudentRepository

async def seed_from_json():
    patient_repo = PatientRepository()
    student_repo = StudentRepository()

    # Seed Patients
    patients_dir = settings.patients_path
    if patients_dir.exists():
        for path in patients_dir.glob("*.json"):
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
                patient = PatientProfile(**data)
                await patient_repo.upsert(patient)
                print(f"Paciente sembrado: {patient.name}")
            except Exception as e:
                print(f"Error sembrando paciente {path.name}: {e}")

    # Seed Students
    students_dir = settings.students_path
    if students_dir.exists():
        for path in students_dir.glob("*.json"):
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
                student = StudentProfile(**data)
                await student_repo.upsert(student)
                print(f"Alumno sembrado: {student.name}")
            except Exception as e:
                print(f"Error sembrando alumno {path.name}: {e}")

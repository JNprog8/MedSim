from typing import List
from fastapi import APIRouter, HTTPException
from backend.domain.models import StudentProfile
from backend.services.container import services

router = APIRouter()

@router.get("/", response_model=List[StudentProfile])
async def list_students():
    return await services.student_service.get_all_students()

@router.get("/{student_id}", response_model=StudentProfile)
async def get_student(student_id: str):
    student = await services.student_service.get_student_id(student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    return student

@router.post("/", response_model=str)
async def create_student(student: StudentProfile):
    return await services.student_service.create_or_update_student(student)

@router.delete("/{student_id}")
async def delete_student(student_id: str):
    success = await services.student_service.delete_student(student_id)
    if not success:
        raise HTTPException(status_code=404, detail="Student not found")
    return {"status": "deleted"}

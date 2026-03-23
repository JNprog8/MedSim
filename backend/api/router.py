from fastapi import APIRouter, Request
from backend.api.v1.endpoints import patients, students, encounters, chat, audio, config, evaluations

api_router = APIRouter()

# Include config and chat at top level
api_router.include_router(config.router, tags=["config"])
api_router.include_router(chat.router, tags=["chat"])

# Special top-level routes to match frontend expectations
@api_router.get("/encounters_public")
async def list_public_encounters():
    return await encounters.list_public_encounters_module()

@api_router.get("/encounters_saved")
async def list_saved_encounters(request: Request):
    return await encounters.list_saved_encounters_module(request)

@api_router.get("/models")
async def get_models():
    return await encounters.get_available_models()

@api_router.get("/evaluations_saved")
async def list_evaluations_saved():
    return await evaluations.list_saved_evaluations()

# Standard prefixed routes
api_router.include_router(patients.router, prefix="/patients", tags=["patients"])
api_router.include_router(students.router, prefix="/students", tags=["students"])
api_router.include_router(encounters.router, prefix="/encounters", tags=["encounters"])
api_router.include_router(audio.router, prefix="/audio", tags=["audio"])
api_router.include_router(evaluations.router, prefix="/evaluations", tags=["evaluations"])

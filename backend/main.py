import os
import time
from pathlib import Path
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.responses import FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager

from backend.core.config import settings
from backend.core.database import connect_to_mongo, close_mongo_connection
from backend.core.seeder import seed_from_json
from backend.api.router import api_router
from backend.services.container import services

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await connect_to_mongo()
    await seed_from_json() # Seed if collections are empty (upsert logic handles it)
    yield
    # Shutdown
    await close_mongo_connection()

app = FastAPI(title=settings.PROJECT_NAME, lifespan=lifespan)

# Static files
BASE_DIR = Path(__file__).resolve().parent.parent
app.mount("/static", StaticFiles(directory=str(BASE_DIR / "static")), name="static")
app.mount("/frontend-assets", StaticFiles(directory=str(BASE_DIR / "frontend" / "assets")), name="frontend_assets")

# API
app.include_router(api_router, prefix="/api")

# --- Frontend Routes ---
def _frontend_file(name: str) -> Path:
    return BASE_DIR / "frontend" / "pages" / name

@app.get("/")
async def root():
    return RedirectResponse(url="/frontend/index")

@app.get("/frontend/index")
async def index_page():
    return FileResponse(_frontend_file("index.html"))

@app.get("/frontend/student")
async def student_page():
    return FileResponse(_frontend_file("student.html"))

@app.get("/frontend/student_join")
async def student_join_page():
    return FileResponse(_frontend_file("student_join.html"))

@app.get("/frontend/student_sessions")
async def student_sessions_page():
    return FileResponse(_frontend_file("student_sessions.html"))

@app.get("/frontend/evaluator")
async def evaluator_page():
    return FileResponse(_frontend_file("evaluator_dashboard.html"))

@app.get("/frontend/evaluator_encounter")
async def evaluator_encounter_page():
    return FileResponse(_frontend_file("evaluator_encounter.html"))

@app.get("/frontend/patients")
async def patients_page():
    return FileResponse(_frontend_file("patients.html"))

@app.get("/frontend/students")
async def students_page():
    return FileResponse(_frontend_file("students.html"))

# --- WebSocket ---
@app.websocket("/ws/encounters/{encounter_id}")
async def ws_encounter_stream(websocket: WebSocket, encounter_id: str):
    await websocket.accept()
    await services.realtime_hub.subscribe(encounter_id, websocket)

    # Send current history snapshot
    encounter = await services.encounter_service.get_encounter(encounter_id)
    if encounter:
        await websocket.send_json({
            "type": "snapshot",
            "encounter_id": encounter_id,
            "patient_id": encounter.patient_id,
            "messages": [m.model_dump() for m in encounter.chat_history],
        })

    try:
        while True:
            # We mostly broadcast events from the orchestrator, 
            # but we can listen for pings/messages here if needed.
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        await services.realtime_hub.unsubscribe(encounter_id, websocket)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=settings.PORT, reload=settings.DEBUG)

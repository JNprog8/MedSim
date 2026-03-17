import time
from pathlib import Path

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles

from backend.api import router as api_router
from backend.services import services

app = FastAPI()

BASE_DIR = Path(__file__).resolve().parent.parent

# Static assets (images, audio, etc.)
app.mount("/static", StaticFiles(directory=str(BASE_DIR / "static")), name="static")

# Frontend JS/CSS assets (served separately from HTML pages).
app.mount(
    "/frontend-assets",
    StaticFiles(directory=str(BASE_DIR / "frontend" / "assets")),
    name="frontend_assets",
)


@app.get("/health")
async def health_check():
    return {"status": "ok", "timestamp": time.time()}


def _frontend_file(name: str) -> Path:
    return BASE_DIR / "frontend" / "pages" / name


@app.get("/")
async def root():
    return RedirectResponse(url="/frontend/index")


@app.get("/student")
@app.get("/frontend/student")
async def student_page():
    return FileResponse(_frontend_file("student.html"))


@app.get("/frontend/index")
async def index_page():
    return FileResponse(_frontend_file("index.html"))


@app.get("/frontend/student_join")
async def student_join_page():
    return FileResponse(_frontend_file("student_join.html"))


@app.get("/evaluator")
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


@app.websocket("/ws/encounters/{encounter_id}")
async def ws_encounter_stream(websocket: WebSocket, encounter_id: str):
    # session_id is optional now; the conversation is scoped by encounter_id (multi-user).
    encounter = services.encounter_service.get_encounter_by_session(
        encounter_id, (websocket.query_params.get("session_id") or "").strip()
    )
    if not encounter:
        await websocket.close(code=1008)
        return

    await websocket.accept()
    await services.realtime_hub.subscribe(encounter_id, websocket)

    # Send snapshot on connect.
    history = services.encounter_service.chat_histories.get(encounter_id, [])
    await websocket.send_json(
        {
            "type": "snapshot",
            "encounter_id": encounter_id,
            "patient_id": encounter.get("patient_id"),
            "mode": encounter.get("mode", "free"),
            "finished_at": encounter.get("finished_at"),
            "messages": [m for m in history if m.get("role") != "system"],
        }
    )

    try:
        while True:
            # Evaluator sends pings; we just consume.
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        await services.realtime_hub.unsubscribe(encounter_id, websocket)


app.include_router(api_router)

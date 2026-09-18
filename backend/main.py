import os
import time
from pathlib import Path
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.responses import FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager

from backend.core.bootstrap import bootstrap_demo_data
from backend.core.config import settings
from backend.core.database import connect_to_mongo, close_mongo_connection, get_database
from backend.api.router import api_router
from backend.services.container import services

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await connect_to_mongo()
    db = get_database()
    services.wire(db)
    if settings.BOOTSTRAP_DEMO:
        await bootstrap_demo_data()
    yield
    # Shutdown
    await close_mongo_connection()

app = FastAPI(title=settings.PROJECT_NAME, lifespan=lifespan)

# Static files
BASE_DIR = Path(__file__).resolve().parent.parent
static_dir = BASE_DIR / "static"
if static_dir.exists():
    app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")

app.mount("/assets", StaticFiles(directory=str(BASE_DIR / "frontend" / "dist" / "assets")), name="react_assets")
img_dir = BASE_DIR / "frontend" / "dist" / "IMG"
if img_dir.exists():
    app.mount("/IMG", StaticFiles(directory=str(img_dir)), name="react_images")

# API
app.include_router(api_router, prefix="/api")

# --- Frontend Routes (React SPA Catch-all) ---
@app.get("/")
async def root():
    return RedirectResponse(url="/frontend/index")

@app.get("/frontend/{catchall:path}")
async def serve_react_app(catchall: str):
    return FileResponse(BASE_DIR / "frontend" / "dist" / "index.html")

@app.get("/frontend")
async def serve_react_app_root():
    return FileResponse(BASE_DIR / "frontend" / "dist" / "index.html")

@app.get("/favicon.svg")
async def serve_favicon():
    favicon_path = BASE_DIR / "frontend" / "dist" / "favicon.svg"
    if favicon_path.exists():
        return FileResponse(favicon_path)
    return FileResponse(BASE_DIR / "frontend" / "public" / "favicon.svg")

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
            "finished_at": encounter.finished_at,
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
    from backend.run import run
    run()

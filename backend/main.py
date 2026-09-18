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
from backend.api import auth as auth_router
from backend.middleware.auth_middleware import SiteAuthMiddleware
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

# Middleware de autenticación por cookie (antes que cualquier ruta)
app.add_middleware(SiteAuthMiddleware)

# Rutas de autenticación (login / logout)
app.include_router(auth_router.router, prefix="/auth", tags=["auth"])

# Static files
BASE_DIR = Path(__file__).resolve().parent.parent
static_dir = BASE_DIR / "static"
if static_dir.exists():
    app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")

app.mount("/assets", StaticFiles(directory=str(BASE_DIR / "frontend" / "dist" / "assets")), name="react_assets")
img_dir = BASE_DIR / "frontend" / "dist" / "IMG"
if img_dir.exists():
    app.mount("/IMG", StaticFiles(directory=str(img_dir)), name="react_images")

audio_dir = BASE_DIR / "frontend" / "dist" / "audio"
if not audio_dir.exists():
    audio_dir = BASE_DIR / "frontend" / "public" / "audio"
if audio_dir.exists():
    app.mount("/audio", StaticFiles(directory=str(audio_dir)), name="react_audio")

# API
app.include_router(api_router, prefix="/api")

# --- Frontend Routes (React SPA Catch-all) ---
@app.get("/favicon.svg")
async def serve_favicon():
    favicon_path = BASE_DIR / "frontend" / "dist" / "favicon.svg"
    if favicon_path.exists():
        return FileResponse(favicon_path)
    return FileResponse(BASE_DIR / "frontend" / "public" / "favicon.svg")

@app.get("/")
async def root():
    return FileResponse(BASE_DIR / "frontend" / "dist" / "index.html")

# Compatibilidad retrocompatible para URLs antiguas con /frontend
@app.get("/frontend/{catchall:path}")
async def serve_react_app_legacy(catchall: str):
    return RedirectResponse(url=f"/{catchall}", status_code=301)

@app.get("/frontend")
async def serve_react_app_legacy_root():
    return RedirectResponse(url="/", status_code=301)

@app.get("/{catchall:path}")
async def serve_react_app(catchall: str):
    index_file = BASE_DIR / "frontend" / "dist" / "index.html"
    if index_file.exists():
        return FileResponse(index_file)
    raise HTTPException(status_code=404, detail="Frontend no compilado. Ejecutá npm run build.")

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

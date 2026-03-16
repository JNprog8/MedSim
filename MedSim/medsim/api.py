from __future__ import annotations

import logging
from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import JSONResponse

from domain.models import PatientProfile
from services import services

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/api/config_state")
async def get_config_state():
    """Obtiene el estado actual de la configuración de todos los servicios."""
    llm = services.llm_service
    stt = services.stt_service
    tts = services.tts_service
    settings = services.settings

    return {
        "server": {"schema_version": settings.SERVER_SCHEMA_VERSION},
        "llm": {
            "base_url": llm.base_url,
            "uses_gemini": llm.is_gemini_backend(),
            "api_key_configured": bool(llm.api_key.strip()) if llm.api_key else False,
            "saved_urls": llm.suggested_urls(),
        },
        "audio": {
            "stt_api_url": stt.api_url,
            "stt_api_key_configured": bool(stt.api_key.strip()) if stt.api_key else False,
            "stt_model": stt.model,
            "stt_configured": bool(stt.model.strip()),
            "tts_api_url": tts.api_url,
            "tts_api_key_configured": bool(tts.api_key.strip()) if tts.api_key else False,
            "tts_voice_id": tts.voice_id,
            "tts_model_id": tts.model_id,
            "tts_language": tts.language,
            "tts_speed": tts.speed,
            "tts_temperature": tts.temperature,
            "tts_configured": all([tts.api_key, tts.voice_id, tts.model_id]),
        },
    }


@router.post("/api/config")
async def update_config(api_url: str = Form(...), api_key: str = Form(None)):
    """Actualiza la configuración del LLM."""
    try:
        return await services.llm_service.update_config(api_url, api_key)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        logger.error("Error actualizando config LLM: %s", exc)
        raise HTTPException(status_code=500, detail="Error interno del servidor")


@router.get("/api/llm_health")
async def llm_health_check():
    """Verifica la salud del backend LLM."""
    return await services.llm_service.health()


@router.post("/api/stt_config")
async def save_stt_config(
    stt_api_url: str = Form(""),
    stt_api_key: str = Form(""),
    stt_model: str = Form(""),
):
    """Guarda la configuración de STT."""
    try:
        return {"status": "success", "stt": services.stt_service.update_config(
            api_url=stt_api_url or None,
            api_key=stt_api_key or None,
            model=stt_model or None,
        )}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/api/tts_config")
async def save_tts_config(
    tts_api_url: str = Form(""),
    tts_api_key: str = Form(""),
    tts_voice_id: str = Form(""),
    tts_model_id: str = Form(""),
    tts_language: str = Form("es"),
    tts_speed: float = Form(None),
    tts_temperature: float = Form(None),
):
    """Guarda la configuración de TTS."""
    return {"status": "success", "tts": services.tts_service.update_config(
        api_url=tts_api_url or None,
        api_key=tts_api_key or None,
        voice_id=tts_voice_id or None,
        model_id=tts_model_id or None,
        language=tts_language or None,
        speed=tts_speed,
        temperature=tts_temperature,
    )}


@router.post("/api/auto_config")
async def run_auto_config(target: str = Form(...), api_key: str = Form(None)):
    """Configuración automática simplificada para backends comunes."""
    if target == "ollama_local":
        return await services.llm_service.update_config("http://localhost:11434", api_key)
    elif target == "gemini_openai":
        return await services.llm_service.update_config("https://generativelanguage.googleapis.com/v1beta/openai", api_key)
    
    raise HTTPException(status_code=400, detail="Objetivo de auto-configuración no reconocido")

from fastapi import APIRouter
from backend.core.config import settings

router = APIRouter()

@router.get("/config_state")
async def get_config_state():
    stt_configured = bool(settings.STT_API_KEY)
    tts_url = (settings.TTS_API_URL or "").lower()
    tts_is_local = bool(
        "audio/tts" in tts_url
        or "piper" in tts_url
        or "tts-ar" in tts_url
        or "http://tts" in tts_url
        or "localhost" in tts_url
        or "127.0.0.1" in tts_url
        or "host.docker.internal" in tts_url
    )
    tts_configured = bool(settings.TTS_API_KEY) or tts_is_local
    return {
        "server": {"schema_version": 3},
        "llm": {
            "base_url": settings.PATIENT_LLM_URL or settings.OLLAMA_URL,
            "api_key_configured": bool(settings.PATIENT_LLM_API_KEY),
            "model": settings.PATIENT_LLM_MODEL,
        },
        "audio": {
            "stt_api_url": settings.STT_API_URL,
            "stt_api_key_configured": stt_configured,
            "stt_configured": stt_configured,
            "stt_model": settings.STT_MODEL,
            "tts_api_url": settings.TTS_API_URL,
            "tts_api_key_configured": tts_configured,
            "tts_configured": tts_configured,
            "tts_voice_id": settings.TTS_VOICE_ID,
            "tts_model_id": settings.TTS_MODEL_ID,
            "tts_language": settings.TTS_LANGUAGE,
        },
    }

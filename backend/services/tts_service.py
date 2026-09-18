import logging
import aiohttp
from typing import Any, Dict, Optional
from fastapi import HTTPException
from backend.core.config import settings
from .utils import normalize_openai_base_url

logger = logging.getLogger(__name__)

class TTSService:
    def __init__(self):
        self.api_url = settings.TTS_API_URL
        self.api_key = settings.TTS_API_KEY
        self.voice_id = getattr(settings, 'TTS_VOICE_ID', None)
        self.model_id = settings.TTS_MODEL_ID
        if self.model_id == "sonic":
            self.model_id = "sonic-3.5"
            
        self.language = settings.TTS_LANGUAGE
        self.speed = getattr(settings, "TTS_SPEED", 1.0)
        self.temperature = getattr(settings, "TTS_TEMPERATURE", 0.5)

    def _is_elevenlabs(self) -> bool:
        url = (self.api_url or "").lower()
        return "api.elevenlabs.io" in url or "elevenlabs" in url

    def _is_cartesia(self) -> bool:
        return "cartesia.ai" in (self.api_url or "").lower()

    def _is_piper_or_local(self) -> bool:
        """
        Determina si se debe usar el protocolo Piper / TTS-ar (FastAPI con POST /audio/tts).
        Detecta URLs internas de Docker (http://tts:8000), localhost, host.docker.internal,
        o URLs que contengan /audio/tts o 'piper'.
        """
        url = (self.api_url or "").lower()
        if not url:
            return False
        if self._is_cartesia() or self._is_elevenlabs():
            return False
        if "api.openai.com" in url:
            return False
        return (
            "audio/tts" in url
            or "piper" in url
            or "tts-ar" in url
            or "http://tts" in url
            or "localhost" in url
            or "127.0.0.1" in url
            or "host.docker.internal" in url
            or not self.api_key
            or (self.api_key or "").lower() in ("local", "none", "no-key")
        )

    def _resolve_piper_voice_id(
        self,
        voice_id: Optional[str] = None,
        gender: Optional[str] = None,
        age: Optional[int] = None,
    ) -> int:
        """
        Mapea el identificador de voz y perfil del paciente al catálogo de TTS-ar:
        0: Daniela  (Femenina adulta)
        1: Martín   (Masculino adulto)
        2: Marta    (Femenina anciana / adulta mayor)
        3: Roberto  (Masculino anciano / adulto mayor)
        4: Sofía    (Femenina joven)
        5: Lucas    (Masculino joven)
        """
        # 1. Si el paciente tiene una voz explícita asignada
        if voice_id is not None and str(voice_id).strip() != "":
            raw = str(voice_id).strip().lower()
            if raw in ("0", "1"):
                return int(raw)
            if any(token in raw for token in ("female", "femenin", "mujer", "daniela")):
                return 0
            if any(token in raw for token in ("male", "masculin", "hombre", "martin")):
                return 1

        # 2. Si no tiene voz explícita, usar el género/avatar del paciente
        if gender:
            g = str(gender).strip().lower()
            if any(token in g for token in ("female", "femenin", "mujer")):
                return 0
            if any(token in g for token in ("male", "masculin", "hombre")):
                return 1

        # 3. Fallback por configuración global o predeterminado
        fallback_raw = str(self.voice_id or "0").strip().lower()
        if fallback_raw in ("0", "1"):
            return int(fallback_raw)

        return 0



    async def text_to_speech(
        self,
        text: str,
        voice_id: Optional[str] = None,
        gender: Optional[str] = None,
        age: Optional[int] = None,
        emotion: str = "neutral",
        **kwargs,
    ) -> bytes:
        if not self.api_url:
            raise HTTPException(status_code=400, detail="TTS API URL no configurada.")

        # --- CASO 1: Servicio local / Docker TTS-ar (Piper VITS) ---
        if self._is_piper_or_local():
            base = self.api_url.rstrip('/')
            url = base if base.endswith("/audio/tts") else f"{base}/audio/tts"
            resolved_id = self._resolve_piper_voice_id(voice_id, gender, age)

            headers = {"Content-Type": "application/json"}
            if self.api_key and self.api_key.lower() not in ("local", "none", "no-key"):
                headers["Authorization"] = f"Bearer {self.api_key}"

            raw_speed = float(self.speed or 1.0)
            safe_speed = max(0.4, min(2.5, raw_speed))

            raw_temp = float(self.temperature or 0.5)
            safe_temp = max(0.0, min(2.0, raw_temp))

            payload = {
                "id": resolved_id,
                "text": text,
                "speed": safe_speed,
                "style_strength": safe_temp,
                "emotion": emotion,
            }

            logger.info(f"[TTSService] Invocando TTS-ar ({url}) con voz id={resolved_id} para {len(text)} caracteres")
            async with aiohttp.ClientSession() as session:
                async with session.post(url, json=payload, headers=headers) as response:
                    if response.status >= 400:
                        body = await response.text()
                        logger.error(f"[TTSService] Error {response.status} de TTS-ar: {body}")
                        raise HTTPException(status_code=response.status, detail=f"Error en TTS-ar: {body}")
                    return await response.read()

        # Para servicios SaaS comerciales (Cartesia, ElevenLabs, OpenAI Cloud), la API key es obligatoria
        if not self.api_key:
            raise HTTPException(status_code=400, detail="TTS API key not configured")

        # --- CASO 2: Cartesia ---
        if self._is_cartesia():
            url = f"{self.api_url.rstrip('/')}/tts/bytes"
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Cartesia-Version": "2024-06-10",
                "Content-Type": "application/json"
            }
            v_id = voice_id or self.voice_id
            payload = {
                "transcript": text,
                "model_id": self.model_id,
                "voice": {"mode": "id", "id": v_id},
                "output_format": {"container": "wav", "encoding": "pcm_f32le", "sample_rate": 44100},
                "language": self.language
            }
            async with aiohttp.ClientSession() as session:
                async with session.post(url, json=payload, headers=headers) as response:
                    if response.status >= 400:
                        body = await response.text()
                        raise HTTPException(status_code=response.status, detail=body)
                    return await response.read()

        # --- CASO 3: ElevenLabs ---
        elif self._is_elevenlabs():
            v_id = voice_id or self.voice_id
            url = f"https://api.elevenlabs.io/v1/text-to-speech/{v_id}"
            headers = {"xi-api-key": self.api_key, "Content-Type": "application/json"}
            payload = {"text": text, "model_id": self.model_id}
            async with aiohttp.ClientSession() as session:
                async with session.post(url, json=payload, headers=headers) as response:
                    if response.status >= 400:
                        body = await response.text()
                        raise HTTPException(status_code=response.status, detail=body)
                    return await response.read()

        # --- CASO 4: OpenAI Cloud Compatible ---
        else:
            base_url = normalize_openai_base_url(self.api_url)
            headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}
            v_id = voice_id or self.voice_id
            payload = {"model": self.model_id, "input": text, "voice": v_id}
            async with aiohttp.ClientSession() as session:
                async with session.post(f"{base_url}/audio/speech", json=payload, headers=headers) as response:
                    if response.status >= 400:
                        body = await response.text()
                        raise HTTPException(status_code=response.status, detail=body)
                    return await response.read()

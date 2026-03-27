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
        self.voice_id = settings.TTS_VOICE_ID if hasattr(settings, 'TTS_VOICE_ID') else None # Wait, I missed a typo in settings?
        self.model_id = settings.TTS_MODEL_ID
        self.language = settings.TTS_LANGUAGE

    def _is_elevenlabs(self) -> bool:
        url = (self.api_url or "").lower()
        return "api.elevenlabs.io" in url or "elevenlabs" in url

    def _is_cartesia(self) -> bool:
        return "cartesia.ai" in (self.api_url or "").lower()

    async def text_to_speech(self, text: str) -> bytes:
        if not self.api_key:
            raise HTTPException(status_code=400, detail="TTS API key not configured")

        if self._is_cartesia():
            url = f"{self.api_url.rstrip('/')}/tts/bytes"
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Cartesia-Version": "2024-06-10",
                "Content-Type": "application/json"
            }
            payload = {
                "transcript": text,
                "model_id": self.model_id,
                "voice": {"mode": "id", "id": self.voice_id},
                "output_format": {"container": "wav", "encoding": "pcm_f32le", "sample_rate": 44100}
            }
            async with aiohttp.ClientSession() as session:
                async with session.post(url, json=payload, headers=headers) as response:
                    if response.status >= 400:
                        body = await response.text()
                        raise HTTPException(status_code=response.status, detail=body)
                    return await response.read()

        elif self._is_elevenlabs():
            url = f"https://api.elevenlabs.io/v1/text-to-speech/{self.voice_id}"
            headers = {"xi-api-key": self.api_key, "Content-Type": "application/json"}
            payload = {"text": text, "model_id": self.model_id}
            async with aiohttp.ClientSession() as session:
                async with session.post(url, json=payload, headers=headers) as response:
                    if response.status >= 400:
                        body = await response.text()
                        raise HTTPException(status_code=response.status, detail=body)
                    return await response.read()

        else:
            # OpenAI-compatible
            base_url = normalize_openai_base_url(self.api_url)
            headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}
            payload = {"model": self.model_id, "input": text, "voice": self.voice_id}
            async with aiohttp.ClientSession() as session:
                async with session.post(f"{base_url}/audio/speech", json=payload, headers=headers) as response:
                    if response.status >= 400:
                        body = await response.text()
                        raise HTTPException(status_code=response.status, detail=body)
                    return await response.read()

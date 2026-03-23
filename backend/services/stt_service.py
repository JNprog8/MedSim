import base64
import logging
import aiohttp
from typing import Any, Dict
from fastapi import HTTPException
from backend.core.config import settings
from .utils import normalize_openai_base_url

logger = logging.getLogger(__name__)

class STTService:
    def __init__(self):
        self.api_url = settings.STT_API_URL
        self.api_key = settings.STT_API_KEY
        self.model = settings.STT_MODEL

    def _is_gemini_api_url(self) -> bool:
        return "generativelanguage.googleapis.com" in (self.api_url or "").lower()

    async def transcribe_audio(self, audio_bytes: bytes, content_type: str = "audio/wav", filename: str = "audio.wav") -> Dict[str, Any]:
        if not self.api_key:
            raise HTTPException(status_code=400, detail="STT API key not configured")

        if not self._is_gemini_api_url():
            base_url = normalize_openai_base_url(self.api_url)
            headers = {"Authorization": f"Bearer {self.api_key}"}
            form = aiohttp.FormData()
            form.add_field("model", self.model)
            form.add_field("language", "es")
            form.add_field("file", audio_bytes, filename=filename, content_type=content_type)

            async with aiohttp.ClientSession() as session:
                async with session.post(f"{base_url}/audio/transcriptions", data=form) as response:
                    if response.status >= 400:
                        body = await response.text()
                        raise HTTPException(status_code=response.status, detail=body)
                    payload = await response.json()
                    return {"text": payload.get("text", ""), "model": self.model}
        else:
            # Gemini Native STT
            prompt = "Transcribe este audio en español. Devuelve solo la transcripción literal."
            payload = {
                "contents": [{
                    "parts": [
                        {"text": prompt},
                        {"inline_data": {"mime_type": content_type, "data": base64.b64encode(audio_bytes).decode("ascii")}}
                    ]
                }]
            }
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent?key={self.api_key}"
            async with aiohttp.ClientSession() as session:
                async with session.post(url, json=payload) as response:
                    if response.status >= 400:
                        body = await response.text()
                        raise HTTPException(status_code=response.status, detail=body)
                    payload = await response.json()
                    text = self._extract_gemini_text(payload)
                    return {"text": text, "model": self.model}

    def _extract_gemini_text(self, payload: Dict[str, Any]) -> str:
        try:
            return payload['candidates'][0]['content']['parts'][0]['text'].strip()
        except (KeyError, IndexError):
            return ""

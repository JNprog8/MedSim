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
        logger.info(
            "STT service initialized url=%s model=%s key_prefix=%s key_suffix=%s key_len=%s",
            self.api_url,
            self.model,
            (self.api_key or "")[:8],
            (self.api_key or "")[-6:],
            len(self.api_key or ""),
        )

    def _is_gemini(self) -> bool:
        # Check if URL explicitly points to Google Gemini
        if self.api_url and "generativelanguage.googleapis.com" in self.api_url.lower():
            return True
        # Check if the model is a Gemini model and URL is not configured to a non-Google endpoint
        if self.model and self.model.lower().startswith("gemini"):
            if not self.api_url or "generativelanguage.googleapis.com" in self.api_url.lower():
                return True
        # Check if the key starts with Google's key prefix (AIzaSy) and URL is not configured to a non-Google endpoint
        if self.api_key and self.api_key.startswith("AIzaSy"):
            if not self.api_url or "generativelanguage.googleapis.com" in self.api_url.lower():
                return True
        return False

    async def transcribe_audio(self, audio_bytes: bytes, content_type: str = "audio/wav", filename: str = "audio.wav") -> Dict[str, Any]:
        if not self.api_key:
            raise HTTPException(status_code=400, detail="STT API key not configured")

        if not self._is_gemini():
            # Fallback to default OpenAI base url if none is provided
            api_url = self.api_url or "https://api.openai.com/v1"
            base_url = normalize_openai_base_url(api_url)
            logger.info(
                "STT service processing request with base_url=%s model=%s key_prefix=%s key_suffix=%s key_len=%s",
                base_url,
                self.model,
                (self.api_key or "")[:8],
                (self.api_key or "")[-6:],
                len(self.api_key or ""),
            )
            # Usar whisper-large-v3-turbo si el modelo viejo está configurado (para evitar futuros deprecations en Groq)
            actual_model = self.model
            if "groq" in base_url.lower() and self.model in ("whisper-large-v3", "whisper-1"):
                actual_model = "whisper-large-v3-turbo"
                logger.info(
                    "STT service using model=%s instead of %s",
                    actual_model,
                    self.model,
                )
                
            headers = {"Authorization": f"Bearer {self.api_key}"}
            form = aiohttp.FormData()
            form.add_field("model", actual_model)
            form.add_field("language", "es")
            form.add_field("file", audio_bytes, filename=filename, content_type=content_type)

            async with aiohttp.ClientSession() as session:
                async with session.post(f"{base_url}/audio/transcriptions", headers=headers, data=form) as response:
                    if response.status >= 400:
                        body = await response.text()
                        logger.error(
                            "STT request failed status=%s url=%s model=%s key_prefix=%s key_len=%s body=%s",
                            response.status,
                            f"{base_url}/audio/transcriptions",
                            actual_model,
                            (self.api_key or "")[:8],
                            len(self.api_key or ""),
                            body[:500],
                        )
                        raise HTTPException(status_code=response.status, detail=f"STT Error ({actual_model}): {body}")
                    payload = await response.json()
                    return {"text": payload.get("text", ""), "model": actual_model}
        else:
            # Gemini Native STT
            logger.info(
                "STT service using Gemini Native STT model=%s",
                self.model,
            )
            prompt = "Transcribe este audio en español. Devuelve solo la transcripción literal."
            payload = {
                "contents": [{
                    "parts": [
                        {"text": prompt},
                        {"inlineData": {"mimeType": content_type, "data": base64.b64encode(audio_bytes).decode("ascii")}}
                    ]
                }]
            }
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent?key={self.api_key}"
            async with aiohttp.ClientSession() as session:
                async with session.post(url, json=payload) as response:
                    if response.status >= 400:
                        body = await response.text()
                        logger.error(
                            "Gemini STT request failed status=%s model=%s key_prefix=%s key_len=%s body=%s",
                            response.status,
                            self.model,
                            (self.api_key or "")[:8],
                            len(self.api_key or ""),
                            body[:500],
                        )
                        raise HTTPException(status_code=response.status, detail=body)
                    payload = await response.json()
                    text = self._extract_gemini_text(payload)
                    return {"text": text, "model": self.model}

    def _extract_gemini_text(self, payload: Dict[str, Any]) -> str:
        try:
            return payload['candidates'][0]['content']['parts'][0]['text'].strip()
        except (KeyError, IndexError):
            return ""

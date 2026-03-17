from __future__ import annotations

import base64
from typing import Any, Dict, Optional

import aiohttp
from fastapi import HTTPException

from services.utils import normalize_openai_base_url


class STTService:
    """STT via API.

    No explicit provider selection: behavior is inferred from `api_url`.
    - If `api_url` contains `generativelanguage.googleapis.com`, use Gemini native `generateContent`.
    - Otherwise, use OpenAI-compatible `POST /audio/transcriptions` at `api_url`.
    """

    def __init__(self, api_url: str, api_key: str, model: str):
        self.api_url = (api_url or "").strip()
        self.api_key = (api_key or "").strip()
        self.model = (model or "").strip()

    def update_config(
        self,
        api_url: Optional[str] = None,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
    ) -> Dict[str, str]:
        if api_url is not None:
            self.api_url = (api_url or "").strip()
        if api_key is not None:
            self.api_key = (api_key or "").strip()
        if model is not None:
            self.model = (model or "").strip()
        return {
            "status": "success",
            "api_url": self.api_url,
            "model": self.model,
        }

    def _looks_like_url(self, value: str) -> bool:
        normalized = str(value or "").strip().lower()
        return normalized.startswith("http://") or normalized.startswith("https://")

    def _is_gemini_api_url(self) -> bool:
        return "generativelanguage.googleapis.com" in (self.api_url or "").lower()

    def _required_missing(self) -> list[str]:
        missing: list[str] = []
        if not self.model:
            missing.append("model")
        if not self.api_key:
            missing.append("api_key")
        if not self._is_gemini_api_url() and not self.api_url:
            missing.append("api_url")
        return missing

    async def health(self) -> Dict[str, Any]:
        missing = self._required_missing()
        if missing:
            return {
                "status": "unconfigured",
                "model": self.model,
                "note": f"Configura STT ({', '.join(missing)})",
            }
        if self._looks_like_url(self.model):
            return {
                "status": "unconfigured",
                "provider": self.provider,
                "model": self.model,
                "note": "El campo STT model debe ser un modelo (ej. whisper-1 / gpt-4o-mini-transcribe / gemini-2.0-flash), no una URL",
            }

        try:
            if not self._is_gemini_api_url():
                base_url = normalize_openai_base_url(self.api_url)
                headers = {"Authorization": f"Bearer {self.api_key}"} if self.api_key else {}
                async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=6), headers=headers) as session:
                    async with session.get(f"{base_url}/models") as response:
                        payload = {}
                        try:
                            payload = await response.json()
                        except Exception:
                            text = await response.text()
                            if text.strip():
                                payload = {"raw": text.strip()}
                        return {
                            "status": "healthy" if response.status == 200 else "unhealthy",
                            "model": self.model,
                            "api_url": base_url,
                            "provider_status_code": response.status,
                            "provider_payload": payload,
                        }

            # Gemini native
            async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=6)) as session:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}?key={self.api_key}"
                async with session.get(url) as response:
                    payload = {}
                    try:
                        payload = await response.json()
                    except Exception:
                        text = await response.text()
                        if text.strip():
                            payload = {"raw": text.strip()}
                    return {
                        "status": "healthy" if response.status == 200 else "unhealthy",
                        "model": self.model,
                        "provider_status_code": response.status,
                        "provider_payload": payload,
                    }
        except Exception as exc:
            return {
                "status": "unhealthy",
                "model": self.model,
                "error": str(exc),
            }

    async def transcribe_audio(self, file) -> dict:
        missing = self._required_missing()
        if missing:
            raise HTTPException(status_code=400, detail=f"STT not configured: missing {', '.join(missing)}")
        if self._looks_like_url(self.model):
            raise HTTPException(status_code=400, detail="STT not configured: model must be a model id, not a URL")

        audio_bytes = await file.read()
        if not audio_bytes:
            raise HTTPException(status_code=400, detail="Audio file is empty")

        mime_type = file.content_type or "audio/wav"
        filename = getattr(file, "filename", None) or "audio.wav"

        if not self._is_gemini_api_url():
            base_url = normalize_openai_base_url(self.api_url)
            headers = {"Authorization": f"Bearer {self.api_key}"}
            form = aiohttp.FormData()
            form.add_field("model", self.model)
            form.add_field("language", "es")
            form.add_field("response_format", "json")
            form.add_field("file", audio_bytes, filename=filename, content_type=mime_type)
            try:
                async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=90), headers=headers) as session:
                    async with session.post(f"{base_url}/audio/transcriptions", data=form) as response:
                        body_text = await response.text()
                        if response.status >= 400:
                            raise HTTPException(status_code=response.status, detail=body_text or "STT failed")
                        try:
                            payload = await response.json()
                        except Exception:
                            payload = {"raw": body_text.strip()}
            except HTTPException:
                raise
            except Exception as exc:
                raise HTTPException(status_code=502, detail=f"STT error: {exc}")

            text = str(payload.get("text") or "").strip() if isinstance(payload, dict) else ""
            if not text:
                raise HTTPException(status_code=502, detail="STT returned no transcription text")
            return {"text": text, "model": self.model, "mime_type": mime_type}

        # Gemini native
        prompt = (
            "Transcribe este audio en espanol. "
            "Devuelve solo la transcripcion literal del hablante, sin resumen ni etiquetas."
        )
        payload = {
            "contents": [
                {
                    "parts": [
                        {"text": prompt},
                        {
                            "inline_data": {
                                "mime_type": mime_type,
                                "data": base64.b64encode(audio_bytes).decode("ascii"),
                            }
                        },
                    ]
                }
            ]
        }
        try:
            async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=90)) as session:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent?key={self.api_key}"
                async with session.post(url, json=payload) as response:
                    body = await response.text()
                    if response.status >= 400:
                        raise HTTPException(status_code=response.status, detail=body or "Gemini transcription failed")
                    try:
                        json_payload = await response.json()
                    except Exception:
                        json_payload = {"raw": body.strip()}
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(status_code=502, detail=f"Gemini transcription error: {exc}")

        text = self._extract_gemini_text(json_payload)
        if not text:
            raise HTTPException(status_code=502, detail="Gemini returned no transcription text")
        return {"text": text, "model": self.model, "mime_type": mime_type}

    def _extract_gemini_text(self, payload: Dict[str, Any]) -> str:
        candidates = payload.get("candidates")
        if not isinstance(candidates, list):
            return ""
        parts: list[str] = []
        for candidate in candidates:
            if not isinstance(candidate, dict):
                continue
            content = candidate.get("content")
            if not isinstance(content, dict):
                continue
            content_parts = content.get("parts")
            if not isinstance(content_parts, list):
                continue
            for part in content_parts:
                if isinstance(part, dict):
                    text = str(part.get("text") or "").strip()
                    if text:
                        parts.append(text)
        return "\n".join(parts).strip()

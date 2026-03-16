from __future__ import annotations

import base64
import json
from typing import Any, Dict, Optional

import aiohttp
from fastapi import HTTPException

from services.settings import normalize_openai_base_url


class TTSService:
    """TTS via API.

    No explicit provider selection: behavior is inferred from `api_url` / `model_id`.
    - If `api_url` contains `api.elevenlabs.io` OR `model_id` starts with `eleven_`, use ElevenLabs.
    - Otherwise, use OpenAI-compatible `POST /audio/speech` at `api_url`.
    """

    def __init__(
        self,
        api_url: str,
        api_key: str,
        voice_id: str,
        model_id: str,
        language: str = "es",
        speed: float | None = None,
        temperature: float | None = None,
    ):
        self.api_url = (api_url or "").strip()
        self.api_key = (api_key or "").strip()
        self.voice_id = (voice_id or "").strip()
        self.model_id = (model_id or "").strip()
        self.language = (language or "").strip() or "es"
        self.speed = speed
        self.temperature = temperature

    def update_config(
        self,
        api_url: Optional[str] = None,
        api_key: Optional[str] = None,
        voice_id: Optional[str] = None,
        model_id: Optional[str] = None,
        language: Optional[str] = None,
        speed: float | None = None,
        temperature: float | None = None,
    ) -> Dict[str, str]:
        if api_url is not None:
            self.api_url = (api_url or "").strip()
        if api_key is not None:
            self.api_key = (api_key or "").strip()
        if voice_id is not None:
            self.voice_id = (voice_id or "").strip()
        if model_id is not None:
            self.model_id = (model_id or "").strip()
        if language is not None:
            self.language = (language or "").strip() or "es"
        if speed is not None:
            self.speed = speed
        if temperature is not None:
            self.temperature = temperature
        return {
            "status": "success",
            "api_url": self.api_url,
            "voice_id": self.voice_id,
            "model_id": self.model_id,
            "language": self.language,
            "speed": "" if self.speed is None else str(self.speed),
            "temperature": "" if self.temperature is None else str(self.temperature),
        }

    def _is_elevenlabs(self) -> bool:
        url = (self.api_url or "").lower()
        if "api.elevenlabs.io" in url or "elevenlabs" in url:
            return True
        return (self.model_id or "").lower().startswith("eleven_")

    def _is_cartesia(self) -> bool:
        return "cartesia.ai" in (self.api_url or "").lower()

    def _required_missing(self) -> list[str]:
        missing: list[str] = []
        if not self.api_key:
            missing.append("api_key")
        if not self.voice_id:
            missing.append("voice_id")
        if not self.model_id:
            missing.append("model_id")
        if not self._is_elevenlabs() and not self.api_url:
            missing.append("api_url")
        return missing

    async def health(self) -> Dict[str, Any]:
        missing = self._required_missing()
        if missing:
            return {
                "status": "unconfigured",
                "voice_id": self.voice_id,
                "model_id": self.model_id,
                "language": self.language,
                "speed": self.speed,
                "temperature": self.temperature,
                "note": f"Configura TTS ({', '.join(missing)})",
            }
        try:
            if self._is_cartesia():
                base = self.api_url.rstrip("/")
                headers = {
                    "Authorization": f"Bearer {self.api_key}",
                    "Cartesia-Version": "2026-03-01",
                    "Accept": "application/json",
                }
                async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=6), headers=headers) as session:
                    async with session.get(f"{base}/voices") as response:
                        payload = {}
                        try:
                            payload = await response.json()
                        except Exception:
                            text = await response.text()
                            if text.strip():
                                payload = {"raw": text.strip()}
                        return {
                            "status": "healthy" if response.status == 200 else "unhealthy",
                            "api_url": base,
                            "voice_id": self.voice_id,
                            "model_id": self.model_id,
                            "language": self.language,
                            "speed": self.speed,
                            "temperature": self.temperature,
                            "provider_status_code": response.status,
                            "provider_payload": payload,
                        }

            if not self._is_elevenlabs():
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
                            "api_url": base_url,
                            "voice_id": self.voice_id,
                            "model_id": self.model_id,
                            "language": self.language,
                            "speed": self.speed,
                            "temperature": self.temperature,
                            "provider_status_code": response.status,
                            "provider_payload": payload,
                        }

            headers = {"xi-api-key": self.api_key, "Accept": "application/json"}
            async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=10), headers=headers) as session:
                async with session.get(f"https://api.elevenlabs.io/v1/voices/{self.voice_id}") as response:
                    payload = {}
                    try:
                        payload = await response.json()
                    except Exception:
                        text = await response.text()
                        if text.strip():
                            payload = {"raw": text.strip()}
                    return {
                        "status": "healthy" if response.status == 200 else "unhealthy",
                        "voice_id": self.voice_id,
                        "model_id": self.model_id,
                        "language": self.language,
                        "speed": self.speed,
                        "temperature": self.temperature,
                        "provider_status_code": response.status,
                        "provider_payload": payload,
                    }
        except Exception as exc:
            return {
                "status": "unhealthy",
                "voice_id": self.voice_id,
                "model_id": self.model_id,
                "language": self.language,
                "speed": self.speed,
                "temperature": self.temperature,
                "error": str(exc),
            }

    async def text_to_speech(self, text: str, speaker_wav=None, patient_id: str | None = None) -> Dict[str, Any]:
        if not str(text or "").strip():
            raise HTTPException(status_code=400, detail="Text cannot be empty")
        missing = self._required_missing()
        if missing:
            raise HTTPException(status_code=400, detail=f"TTS not configured: missing {', '.join(missing)}")

        if self._is_cartesia():
            base = self.api_url.rstrip("/")
            url = f"{base}/tts/bytes"
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Cartesia-Version": "2026-03-01",
                "Content-Type": "application/json",
                "Accept": "audio/wav",
            }
            payload = {
                "model_id": self.model_id,
                "transcript": text,
                "voice": {"mode": "id", "id": self.voice_id},
                "output_format": {"container": "wav", "encoding": "pcm_f32le", "sample_rate": 44100},
                "language": self.language or "es",
            }
            if self.speed is not None:
                payload["speed"] = self.speed
            if self.temperature is not None:
                payload["temperature"] = self.temperature
            try:
                async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=90), headers=headers) as session:
                    async with session.post(url, json=payload) as response:
                        audio_bytes = await response.read()
                        if response.status >= 400:
                            detail = self._extract_error_detail(audio_bytes)
                            raise HTTPException(status_code=response.status, detail=detail or "Cartesia TTS failed")
                        content_type = response.headers.get("Content-Type", "audio/wav")
            except HTTPException:
                raise
            except Exception as exc:
                raise HTTPException(status_code=502, detail=f"Cartesia TTS error: {exc}")

            return {
                "audio_base64": base64.b64encode(audio_bytes).decode("ascii"),
                "content_type": content_type,
                "size_bytes": len(audio_bytes),
                "voice_id": self.voice_id,
                "model_id": self.model_id,
                "language": self.language,
            }

        if not self._is_elevenlabs():
            base_url = normalize_openai_base_url(self.api_url)
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
                "Accept": "audio/mpeg",
            }
            payload = {
                "model": self.model_id,
                "voice": self.voice_id,
                "input": text,
                "format": "mp3",
            }
            try:
                async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=90), headers=headers) as session:
                    async with session.post(f"{base_url}/audio/speech", json=payload) as response:
                        audio_bytes = await response.read()
                        if response.status >= 400:
                            detail = self._extract_error_detail(audio_bytes)
                            raise HTTPException(status_code=response.status, detail=detail or "TTS failed")
                        content_type = response.headers.get("Content-Type", "audio/mpeg")
            except HTTPException:
                raise
            except Exception as exc:
                raise HTTPException(status_code=502, detail=f"TTS error: {exc}")
            return {
                "audio_base64": base64.b64encode(audio_bytes).decode("ascii"),
                "content_type": content_type,
                "size_bytes": len(audio_bytes),
                "voice_id": self.voice_id,
                "model_id": self.model_id,
                "language": self.language,
            }

        # ElevenLabs
        payload = {
            "text": text,
            "model_id": self.model_id,
            "output_format": "mp3_44100_128",
        }
        try:
            headers = {
                "xi-api-key": self.api_key,
                "Accept": "audio/mpeg",
                "Content-Type": "application/json",
            }
            async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=90), headers=headers) as session:
                url = f"https://api.elevenlabs.io/v1/text-to-speech/{self.voice_id}"
                async with session.post(url, json=payload) as response:
                    audio_bytes = await response.read()
                    if response.status >= 400:
                        detail = self._extract_error_detail(audio_bytes)
                        raise HTTPException(status_code=response.status, detail=detail or "ElevenLabs TTS failed")
                    content_type = response.headers.get("Content-Type", "audio/mpeg")
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(status_code=502, detail=f"ElevenLabs TTS error: {exc}")

        return {
            "audio_base64": base64.b64encode(audio_bytes).decode("ascii"),
            "content_type": content_type,
            "size_bytes": len(audio_bytes),
            "voice_id": self.voice_id,
            "model_id": self.model_id,
            "language": self.language,
        }

    def _extract_error_detail(self, raw_bytes: bytes) -> str:
        text = raw_bytes.decode("utf-8", "ignore").strip()
        if not text:
            return ""
        try:
            payload = json.loads(text)
        except json.JSONDecodeError:
            return text
        if not isinstance(payload, dict):
            return text
        detail = payload.get("detail")
        if isinstance(detail, dict):
            message = str(detail.get("message") or "").strip()
            code = str(detail.get("code") or "").strip()
            if message and code:
                return f"{message} ({code})"
            if message:
                return message
        if isinstance(detail, str) and detail.strip():
            return detail.strip()
        message = str(payload.get("message") or "").strip()
        return message or text

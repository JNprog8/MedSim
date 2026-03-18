from __future__ import annotations

import logging
import socket
from typing import Any, Dict, List

import aiohttp
from fastapi import HTTPException
from openai import AsyncOpenAI

from .settings import AppSettings, normalize_openai_base_url

logger = logging.getLogger(__name__)


class LLMService:
    def __init__(self, settings: AppSettings):
        self.settings = settings
        self.base_url = normalize_openai_base_url(settings.patient_llm_url) or normalize_openai_base_url(settings.ollama_url)
        self.api_key = settings.patient_llm_api_key or "ollama"
        self.client = AsyncOpenAI(api_key=self.api_key, base_url=self.base_url)
        self.cached_model_by_base_url: Dict[str, str] = {}
        logger.info("LLM backend initialized: base_url=%s", self.base_url)

    def rebuild_client(self) -> None:
        self.client = AsyncOpenAI(api_key=self.api_key, base_url=self.base_url)

    def is_gemini_backend(self) -> bool:
        return "generativelanguage.googleapis.com" in (self.base_url or "").lower()

    async def list_models(self) -> list[str]:
        models = await self.client.models.list()
        return [model.id for model in models.data]

    async def chat_with_model(self, messages: list[dict], model: str, max_tokens: int, temperature: float) -> str:
        response = await self.client.chat.completions.create(
            model=model,
            messages=messages,
            max_tokens=max_tokens,
            temperature=temperature,
        )
        return response.choices[0].message.content or ""

    async def update_config(self, api_url: str, api_key: str | None = None) -> Dict[str, str]:
        normalized = normalize_openai_base_url(api_url)
        if not normalized:
            raise ValueError("api_url cannot be empty")
        if api_key is not None and api_key.strip():
            self.api_key = api_key.strip()
        self.base_url = normalized
        self.rebuild_client()
        self.cached_model_by_base_url.pop(self.base_url, None)
        return {"status": "success", "base_url": self.base_url}

    async def get_first_available_model(self) -> str:
        if self.base_url in self.cached_model_by_base_url:
            return self.cached_model_by_base_url[self.base_url]
        try:
            models = await self.list_models()
            if not models:
                raise HTTPException(status_code=500, detail="No models available")
            selected = models[0]
            self.cached_model_by_base_url[self.base_url] = selected
            return selected
        except HTTPException:
            raise
        except Exception as exc:
            if "authentication" in str(exc).lower():
                raise HTTPException(status_code=500, detail="Invalid or missing API key")
            raise HTTPException(status_code=500, detail=str(exc))

    def suggested_urls(self) -> List[Dict[str, str]]:
        hostnames = ["host.docker.internal", "localhost", "127.0.0.1"]
        try:
            hostnames.append(socket.gethostname())
        except Exception:
            pass

        urls = [
            {"url": self.base_url, "label": "Current LLM backend"},
            {"url": "http://127.0.0.1:11434", "label": "Ollama (localhost)"},
            {"url": "https://generativelanguage.googleapis.com/v1beta/openai", "label": "Gemini (OpenAI-compatible)"},
        ]
        for host in hostnames:
            urls.extend(
                [
                    {"url": f"http://{host}:11434", "label": "Ollama (default port 11434)"},
                    {"url": f"http://{host}:7000", "label": "vLLM (common port 7000)"},
                    {"url": f"http://{host}:8000", "label": "OpenAI-compatible (common port 8000)"},
                ]
            )
        seen = set()
        result = []
        for item in urls:
            url = item.get("url", "")
            if url and url not in seen:
                seen.add(url)
                result.append(item)
        return result

    async def health(self) -> Dict[str, object]:
        try:
            models = await self.list_models()
            return {
                "status": "healthy",
                "models_available": bool(models),
                "models_count": len(models),
                "base_url": self.base_url,
            }
        except Exception as exc:
            return {
                "status": "unhealthy",
                "models_available": False,
                "models_count": 0,
                "base_url": self.base_url,
                "error": str(exc),
            }

    async def probe_base_url(self, base_url: str) -> bool:
        url = normalize_openai_base_url(base_url)
        if not url:
            return False
        try:
            async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=3)) as session:
                async with session.get(f"{url}/models") as response:
                    return response.status == 200
        except Exception:
            return False

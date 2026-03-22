from __future__ import annotations

import logging
from typing import Any, Dict

from fastapi import HTTPException
from openai import APIConnectionError
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

    def _connection_help_detail(self) -> str:
        configured_model = (self.settings.patient_llm_model or "").strip()
        base_url = self.base_url or "(empty)"
        if configured_model:
            return (
                f"Cannot reach the configured LLM backend at {base_url}. "
                "Check PATIENT_LLM_URL / PATIENT_LLM_API_KEY / PATIENT_LLM_MODEL in .env."
            )
        return (
            f"Cannot reach the LLM backend at {base_url}. "
            "Create a .env with PATIENT_LLM_URL / PATIENT_LLM_API_KEY / PATIENT_LLM_MODEL, "
            "or run Ollama locally on http://127.0.0.1:11434."
        )

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
        except APIConnectionError:
            raise HTTPException(status_code=503, detail=self._connection_help_detail())
        except HTTPException:
            raise
        except Exception as exc:
            if "authentication" in str(exc).lower():
                raise HTTPException(status_code=500, detail="Invalid or missing API key")
            raise HTTPException(status_code=500, detail=str(exc))

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
                "error": self._connection_help_detail() if isinstance(exc, APIConnectionError) else str(exc),
            }

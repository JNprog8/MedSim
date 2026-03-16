from __future__ import annotations

import logging
from typing import Dict, List

from fastapi import HTTPException
from openai import AsyncOpenAI

from services.settings import AppSettings
from services.utils import normalize_openai_base_url, get_suggested_llm_urls

logger = logging.getLogger(__name__)


class LLMService:
    def __init__(self, settings: AppSettings):
        self.settings = settings
        # Normalizamos la URL base y proporcionamos un fallback seguro a Ollama
        self.base_url = normalize_openai_base_url(settings.PATIENT_LLM_URL) or normalize_openai_base_url(settings.OLLAMA_URL)
        self.api_key = settings.PATIENT_LLM_API_KEY or "ollama"
        self._initialize_client()
        self.cached_model_by_base_url: Dict[str, str] = {}
        logger.info("LLM backend inicializado en: %s", self.base_url)

    def _initialize_client(self) -> None:
        """Inicia o reinicia el cliente AsyncOpenAI."""
        self.client = AsyncOpenAI(api_key=self.api_key, base_url=self.base_url)

    def is_gemini_backend(self) -> bool:
        """Comprueba si se está usando el backend de Google Gemini."""
        return "generativelanguage.googleapis.com" in (self.base_url or "").lower()

    async def list_models(self) -> List[str]:
        """Obtiene la lista de IDs de modelos disponibles de forma funcional."""
        try:
            models = await self.client.models.list()
            return [model.id for model in models.data]
        except Exception as exc:
            logger.error("Error al listar modelos: %s", exc)
            return []

    async def chat_with_model(self, messages: List[Dict[str, str]], model: str, max_tokens: int, temperature: float) -> str:
        """Ejecuta una petición de chat contra el backend LLM."""
        try:
            response = await self.client.chat.completions.create(
                model=model,
                messages=messages,
                max_tokens=max_tokens,
                temperature=temperature,
            )
            return response.choices[0].message.content or ""
        except Exception as exc:
            logger.error("Error en chat_with_model: %s", exc)
            raise HTTPException(status_code=502, detail="Error en la comunicación con el LLM")

    async def update_config(self, api_url: str, api_key: str | None = None) -> Dict[str, str]:
        """Actualiza la configuración del backend dinámicamente."""
        normalized = normalize_openai_base_url(api_url)
        if not normalized:
            raise ValueError("La URL de la API no puede estar vacía")
        
        if api_key and api_key.strip():
            self.api_key = api_key.strip()
            
        self.base_url = normalized
        self._initialize_client()
        self.cached_model_by_base_url.pop(self.base_url, None)
        
        return {"status": "success", "base_url": self.base_url}

    async def get_first_available_model(self) -> str:
        """Busca el primer modelo disponible con caché por URL."""
        if self.base_url in self.cached_model_by_base_url:
            return self.cached_model_by_base_url[self.base_url]

        models = await self.list_models()
        if not models:
            raise HTTPException(status_code=500, detail="No hay modelos disponibles en este backend")
        
        selected = models[0]
        self.cached_model_by_base_url[self.base_url] = selected
        return selected

    def suggested_urls(self) -> List[Dict[str, str]]:
        """Delega la generación de sugerencias a la utilidad centralizada."""
        return get_suggested_llm_urls(self.base_url)

    async def health(self) -> Dict[str, str]:
        """Comprueba si el backend responde correctamente."""
        try:
            await self.list_models()
            return {"status": "ok", "backend": self.base_url}
        except Exception:
            return {"status": "error", "backend": self.base_url}

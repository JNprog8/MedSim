import logging
from typing import Dict, List, Optional
from fastapi import HTTPException
from openai import AsyncOpenAI, APIConnectionError
from backend.core.config import settings
from .utils import normalize_openai_base_url

logger = logging.getLogger(__name__)

class LLMService:
    def __init__(self):
        self.base_url = normalize_openai_base_url(settings.PATIENT_LLM_URL) or normalize_openai_base_url(settings.OLLAMA_URL)
        self.api_key = settings.PATIENT_LLM_API_KEY or "ollama"
        self.client = AsyncOpenAI(api_key=self.api_key, base_url=self.base_url)
        self.cached_model_by_base_url: Dict[str, str] = {}

    async def list_models(self) -> List[str]:
        try:
            models = await self.client.models.list()
            return [model.id for model in models.data]
        except Exception as e:
            logger.error(f"Error listing models: {e}")
            return []

    async def chat_with_model(self, messages: List[Dict[str, str]], model: Optional[str] = None, max_tokens: int = 500, temperature: float = 0.7) -> str:
        selected_model = model or settings.PATIENT_LLM_MODEL
        try:
            response = await self.client.chat.completions.create(
                model=selected_model,
                messages=messages,
                max_tokens=max_tokens,
                temperature=temperature,
            )
            return response.choices[0].message.content or ""
        except Exception as e:
            logger.error(f"Error in chat completion: {e}")
            raise HTTPException(status_code=500, detail=str(e))

    async def get_first_available_model(self) -> str:
        if self.base_url in self.cached_model_by_base_url:
            return self.cached_model_by_base_url[self.base_url]
        models = await self.list_models()
        if models:
            self.cached_model_by_base_url[self.base_url] = models[0]
            return models[0]
        return settings.PATIENT_LLM_MODEL

import logging
from typing import Dict, List, Optional
from fastapi import HTTPException
from openai import AsyncOpenAI

from backend.core.config import settings
from backend.services.ai_interfaces import ILLMService
from .utils import normalize_openai_base_url

logger = logging.getLogger(__name__)

class LLMService(ILLMService):
    """
    Implementation: Proveedor de LLM basado en OpenAI SDK (compatible con Ollama/vLLM).
    Sigue OCP al permitir configurar el modelo y la base URL externamente.
    """
    
    def __init__(self):
        self.__base_url = normalize_openai_base_url(settings.PATIENT_LLM_URL) or normalize_openai_base_url(settings.OLLAMA_URL)
        self.__api_key = settings.PATIENT_LLM_API_KEY or "ollama"
        self.__client = AsyncOpenAI(api_key=self.__api_key, base_url=self.__base_url)
        self.__default_model = settings.PATIENT_LLM_MODEL

    async def chat_with_model(self, messages: List[Dict[str, str]]) -> str:
        """
        Tell: Realiza la inferencia con el modelo configurado.
        """
        try:
            response = await self.__client.chat.completions.create(
                model=self.__default_model,
                messages=messages,
                max_tokens=500,
                temperature=0.7,
            )
        except Exception as e:
            logger.exception("Error crítico en comunicación con LLM")
            raise HTTPException(status_code=500, detail=f"LLM Error: {str(e)}")
        else:
            return response.choices[0].message.content or ""

    async def list_models(self) -> List[str]:
        try:
            models = await self.__client.models.list()
            return [model.id for model in models.data]
        except Exception as e:
            logger.error(f"Error listing models: {e}")
            return []

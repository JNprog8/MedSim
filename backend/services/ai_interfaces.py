from abc import ABC, abstractmethod
from typing import List, Dict, Any

class ILLMService(ABC):
    """
    Spec Definition: Interface para servicios de Modelos de Lenguaje.
    Permite intercambiar proveedores (OpenAI, Gemini, Ollama) sin modificar el cliente.
    """
    @abstractmethod
    async def chat_with_model(self, messages: List[Dict[str, str]]) -> str: ...

class ISTTService(ABC):
    """Spec Definition: Interface para Speech-to-Text."""
    @abstractmethod
    async def transcribe_audio(self, audio_bytes: bytes, **kwargs) -> Dict[str, Any]: ...

class ITTSService(ABC):
    """Spec Definition: Interface para Text-to-Speech."""
    @abstractmethod
    async def text_to_speech(self, text: str) -> bytes: ...

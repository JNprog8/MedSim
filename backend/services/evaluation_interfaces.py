from abc import ABC, abstractmethod
from typing import Dict, List, Any, Optional
from backend.domain.models import Encounter

class IEvaluationStrategy(ABC):
    """
    Spec Definition: Interface para estrategias de evaluación.
    Sigue el OCP: para agregar un nuevo marco (ej. Mini-CEX), solo se crea una clase.
    """
    @abstractmethod
    def get_framework_name(self) -> str: ...

    @abstractmethod
    def get_evaluation_criteria(self) -> List[Dict[str, Any]]: ...

    @abstractmethod
    def format_for_llm(self) -> str: ...

class IAutoEvaluationService(ABC):
    """Spec Definition: Interface para el servicio de autoevaluación por IA."""
    @abstractmethod
    async def generate_feedback(self, encounter: Encounter, strategy: IEvaluationStrategy) -> Dict[str, Any]: ...

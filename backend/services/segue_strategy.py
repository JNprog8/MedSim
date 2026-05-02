from typing import Dict, List, Any
from backend.services.evaluation_interfaces import IEvaluationStrategy

class SegueEvaluationStrategy(IEvaluationStrategy):
    """
    Implementation: Estrategia específica para el marco SEGUE.
    Encapsula los criterios de evaluación de habilidades de comunicación.
    """

    def get_framework_name(self) -> str:
        return "SEGUE"

    def get_evaluation_criteria(self) -> List[Dict[str, Any]]:
        # Definición breve de dominios SEGUE (simplificado para el LLM)
        return [
            {"id": "set_the_stage", "label": "Set the Stage (Saludó, se presentó)"},
            {"id": "elicit_info", "label": "Elicit Information (Escucha activa, preguntas abiertas)"},
            {"id": "give_info", "label": "Give Information (Explicó claramente)"},
            {"id": "understand_perspective", "label": "Understand Perspective (Empatía)"},
            {"id": "end_encounter", "label": "End Encounter (Resumen, próximos pasos)"}
        ]

    def format_for_llm(self) -> str:
        """Serialización compacta para inyectar en el prompt."""
        criteria = self.get_evaluation_criteria()
        return "\n".join([f"- {c['label']}" for c in criteria])

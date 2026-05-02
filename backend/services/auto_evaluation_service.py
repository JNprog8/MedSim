import logging
from typing import Dict, Any

from backend.domain.models import Encounter
from backend.services.ai_interfaces import ILLMService
from backend.services.evaluation_interfaces import IAutoEvaluationService, IEvaluationStrategy

logger = logging.getLogger(__name__)

class AutoEvaluationService(IAutoEvaluationService):
    """
    Implementation: Servicio de autoevaluación temporal mediante IA.
    Aplica TDA: Pide al encuentro su contexto y a la estrategia su formato.
    """

    def __init__(self, llm_service: ILLMService):
        self.__llm_service = llm_service

    async def generate_feedback(self, encounter: Encounter, strategy: IEvaluationStrategy) -> Dict[str, Any]:
        """
        Genera un feedback cualitativo y cuantitativo preliminar.
        """
        history = encounter.get_llm_context()
        framework = strategy.get_framework_name()
        criteria = strategy.format_for_llm()

        prompt = self.__build_prompt(history, framework, criteria)
        
        try:
            response_text = await self.__llm_service.chat_with_model([
                {"role": "system", "content": prompt}
            ])
            return {
                "framework": framework,
                "auto_feedback": response_text,
                "status": "preliminary"
            }
        except Exception as e:
            logger.exception("Fallo en la generación de autoevaluación")
            return {"error": "No se pudo generar la autoevaluación", "details": str(e)}

    def __build_prompt(self, history: list, framework: str, criteria: str) -> str:
        """Construcción modular del prompt de evaluación."""
        transcript = "\n".join([f"{m['role'].upper()}: {m['content']}" for m in history])
        
        return f"""
Actuá como un observador clínico experto evaluando a un estudiante de medicina.
MARCO DE EVALUACIÓN: {framework}
CRITERIOS A CONSIDERAR:
{criteria}

TRANSCRIPCIÓN DEL ENCUENTRO:
{transcript}

TAREA:
Proporcioná una breve devolución (feedback) para el estudiante.
REGLAS:
1. Sé constructivo pero breve (máximo 3 párrafos).
2. NO menciones fallos específicos ni debilidades (eso lo hará el profesor).
3. Enfocate en la impresión general de la comunicación clínica.
4. Usá un tono profesional y alentador.
5. NO des una nota numérica, solo una apreciación cualitativa global.
""".strip()

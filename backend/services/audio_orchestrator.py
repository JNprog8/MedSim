import base64
import logging
from typing import Optional, Dict, Any
from fastapi import HTTPException, UploadFile

from backend.domain.models import Message
from backend.services.ai_interfaces import ILLMService, ISTTService, ITTSService
from backend.services.interfaces import IPatientService
from backend.services.encounter_service import EncounterService
from backend.services.hub import EncounterRealtimeHub

logger = logging.getLogger(__name__)

class AudioOrchestrator:
    """
    Implementation: Orquestador de interacción multimodal (Audio/Texto).
    Aplica 'Tell, Don't Ask' al delegar la gestión de estado a los modelos y servicios.
    Sigue OCP mediante la resolución dinámica de modos de entrada.
    """

    def __init__(
        self,
        patient_service: IPatientService,
        encounter_service: EncounterService,
        audio_service: Any, 
        llm_service: ILLMService,
        stt_service: ISTTService,
        tts_service: ITTSService,
        prompt_service: Any, 
        realtime_hub: EncounterRealtimeHub
    ):
        self.__patient_service = patient_service
        self.__encounter_service = encounter_service
        self.__audio_service = audio_service
        self.__llm_service = llm_service
        self.__stt_service = stt_service
        self.__tts_service = tts_service
        self.__prompt_service = prompt_service
        self.__realtime_hub = realtime_hub

    async def process_text_input(
        self,
        encounter_id: str,
        text: str,
        include_tts: bool = False,
        user_audio_url: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Flujo principal de conversación.
        """
        if not text or not text.strip():
            logger.info(f"[process_text_input] Texto vacío recibido para encuentro {encounter_id}. Se descarta.")
            return {
                "encounter_id": encounter_id,
                "user_text": "",
                "reply_text": "",
                "assistant_message": None,
                "assistant_audio": None,
                "ignored": True,
                "reason": "empty_text",
            }

        encounter = await self.__encounter_service.get_encounter(encounter_id)
        if not encounter: raise HTTPException(status_code=404, detail="Encounter not found")
        
        patient = await self.__patient_service.get_patient_by_id(encounter.patient_id)
        if not patient: raise HTTPException(status_code=404, detail="Patient profile not found")

        user_msg = encounter.add_message("user", text.strip(), audio_url=user_audio_url)
        await self.__encounter_service.repository.upsert(encounter, id_field="encounter_id")
        await self.__realtime_hub.broadcast(encounter_id, user_msg.model_dump())

        system_prompt = self.__prompt_service.build_patient_system_prompt(patient)
        llm_messages = [{"role": "system", "content": system_prompt}] + encounter.get_llm_context()

        try:
            assistant_text = await self.__llm_service.chat_with_model(llm_messages)
        except Exception as e:
            logger.warning(f"[AudioOrchestrator] Falló la llamada al LLM ({e}). Usando respuesta de respaldo como paciente.")
            assistant_text = "Disculpe, doctor, no lo escuché bien. ¿Me podría repetir?"

        if not assistant_text or not assistant_text.strip():
            logger.warning("[AudioOrchestrator] El LLM devolvió texto vacío. Usando respuesta de respaldo como paciente.")
            assistant_text = "Disculpe, doctor, no lo escuché bien. ¿Me podría repetir?"

        audio_data = await self.__handle_tts(encounter_id, assistant_text, patient=patient) if include_tts else {}

        assistant_msg = encounter.add_message("assistant", assistant_text, audio_url=audio_data.get("audio_url"))
        await self.__encounter_service.repository.upsert(encounter, id_field="encounter_id")
        await self.__realtime_hub.broadcast(encounter_id, assistant_msg.model_dump())

        return self.__build_response_payload(encounter_id, text, assistant_text, assistant_msg, audio_data)

    async def process_audio_bytes(
        self,
        encounter_id: str,
        audio_bytes: bytes,
        content_type: str = "audio/wav",
        filename: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Procesa audio en bruto (bytes) sin necesidad de un UploadFile.
        Usado por UnrealAudioHandler y cualquier integración que envíe bytes directamente.
        Flujo: STT → guarda audio del usuario → LLM → TTS → respuesta.
        """
        if not audio_bytes or len(audio_bytes) < 1200:
            logger.info(f"[process_audio_bytes] Audio nulo o demasiado corto ({len(audio_bytes) if audio_bytes else 0} bytes). Se descarta.")
            return {
                "encounter_id": encounter_id,
                "user_text": "",
                "reply_text": "",
                "assistant_message": None,
                "assistant_audio": None,
                "ignored": True,
                "reason": "audio_too_short",
            }

        stt_result = await self.__stt_service.transcribe_audio(audio_bytes, content_type=content_type)
        user_text = (stt_result.get("text") or "").strip()
        logger.info(f"[process_audio_bytes] STT result: '{user_text}'")

        has_speech = any(c.isalnum() for c in user_text)
        if not has_speech:
            logger.info("[process_audio_bytes] No se detectó habla audible en la transcripción. Se descarta.")
            return {
                "encounter_id": encounter_id,
                "user_text": "",
                "reply_text": "",
                "assistant_message": None,
                "assistant_audio": None,
                "ignored": True,
                "reason": "no_speech_detected",
            }

        audio_asset = await self.__audio_service.save_audio(
            encounter_id=encounter_id,
            audio_bytes=audio_bytes,
            content_type=content_type,
        )
        user_audio_url = f"/api/audio/{audio_asset.id}"

        return await self.process_text_input(
            encounter_id=encounter_id,
            text=user_text,
            include_tts=True,
            user_audio_url=user_audio_url,
        )

    async def process_audio_file(
        self,
        encounter_id: str,
        audio_file: UploadFile,
    ) -> Dict[str, Any]:
        """
        Procesa un UploadFile de audio: STT → guarda audio del usuario → LLM → TTS → respuesta.
        Usado por el endpoint web /api/audio_turn.
        """
        audio_bytes = await audio_file.read()

        if not audio_bytes or len(audio_bytes) < 1200:
            logger.info(f"[process_audio_file] Audio nulo o demasiado corto ({len(audio_bytes) if audio_bytes else 0} bytes). Se descarta.")
            return {
                "encounter_id": encounter_id,
                "user_text": "",
                "reply_text": "",
                "assistant_message": None,
                "assistant_audio": None,
                "ignored": True,
                "reason": "audio_too_short",
            }

        stt_result = await self.__stt_service.transcribe_audio(
            audio_bytes,
            content_type=audio_file.content_type or "audio/wav"
        )
        user_text = (stt_result.get("text") or "").strip()
        logger.info(f"[process_audio_file] STT result: '{user_text}'")

        has_speech = any(c.isalnum() for c in user_text)
        if not has_speech:
            logger.info("[process_audio_file] No se detectó habla audible en la transcripción. Se descarta.")
            return {
                "encounter_id": encounter_id,
                "user_text": "",
                "reply_text": "",
                "assistant_message": None,
                "assistant_audio": None,
                "ignored": True,
                "reason": "no_speech_detected",
            }

        audio_asset = await self.__audio_service.save_audio(encounter_id, audio_bytes, audio_file.content_type)

        return await self.process_text_input(
            encounter_id,
            user_text,
            include_tts=True,
            user_audio_url=f"/api/audio/{audio_asset.id}"
        )

    async def __handle_tts(self, encounter_id: str, text: str, patient: Optional[Any] = None) -> Dict[str, Any]:
        """Encapsulación de lógica TTS con perfil de voz del paciente."""
        if not text or not text.strip():
            logger.info("[__handle_tts] No hay texto audible para sintetizar.")
            return {}

        try:
            voice = getattr(patient, "voice", None)
            gender = getattr(patient, "avatar", None)
            age = getattr(patient, "age", None)

            audio_bytes = await self.__tts_service.text_to_speech(
                text=text.strip(),
                voice_id=voice,
                gender=gender,
                age=age,
            )
            audio_asset = await self.__audio_service.save_audio(
                encounter_id=encounter_id,
                audio_bytes=audio_bytes,
                content_type="audio/wav",
            )
            return {
                "audio_url": f"/api/audio/{audio_asset.id}",
                "audio_base64": base64.b64encode(audio_bytes).decode("ascii"),
                "content_type": "audio/wav"
            }
        except Exception as e:
            logger.warning(f"[__handle_tts] Falló la síntesis de voz TTS (se continúa solo con texto): {e}")
            return {}

    def __build_response_payload(self, eid: str, text: str, reply: str, msg: Message, audio: Dict) -> Dict[str, Any]:
        """Centralización de la construcción del payload de respuesta."""
        return {
            "encounter_id": eid,
            "user_text": text,
            "reply_text": reply,
            "assistant_message": msg.model_dump(),
            "assistant_audio": audio if audio else None
        }

import base64
import logging
from typing import Optional, Dict, Any, List
from fastapi import HTTPException, UploadFile

from backend.domain.models import Encounter, Message, PatientProfile
from backend.services.ai_interfaces import ILLMService, ISTTService, ITTSService
from backend.services.interfaces import IPatientService
from backend.services.encounter_service import EncounterService
from backend.services.hub import EncounterRealtimeHub
from backend.services.audio_input_mode import AudioInputMode, resolve_audio_input_mode

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
        encounter = await self.__encounter_service.get_encounter(encounter_id)
        if not encounter: raise HTTPException(status_code=404, detail="Encounter not found")
        
        patient = await self.__patient_service.get_patient_by_id(encounter.patient_id)
        if not patient: raise HTTPException(status_code=404, detail="Patient profile not found")

        user_msg = encounter.add_message("user", text, audio_url=user_audio_url)
        await self.__encounter_service.repository.upsert(encounter, id_field="encounter_id")
        await self.__realtime_hub.broadcast(encounter_id, user_msg.model_dump())

        system_prompt = self.__prompt_service.build_patient_system_prompt(patient)
        llm_messages = [{"role": "system", "content": system_prompt}] + encounter.get_llm_context()

        assistant_text = await self.__llm_service.chat_with_model(llm_messages)

        audio_data = await self.__handle_tts(encounter_id, assistant_text) if include_tts else {}

        assistant_msg = encounter.add_message("assistant", assistant_text, audio_url=audio_data.get("audio_url"))
        await self.__encounter_service.repository.upsert(encounter, id_field="encounter_id")
        await self.__realtime_hub.broadcast(encounter_id, assistant_msg.model_dump())

        return self.__build_response_payload(encounter_id, text, assistant_text, assistant_msg, audio_data)

    async def process_audio_input_by_mode(
        self,
        encounter_id: str,
        audio_file: UploadFile,
        mode: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        OCP: Resolución de estrategia según el modo.
        """
        resolved_mode = resolve_audio_input_mode(mode)
        
        if resolved_mode == AudioInputMode.UNREAL:
            return await self.__process_unreal_audio(encounter_id, audio_file)
        
        return await self.__process_standard_audio(encounter_id, audio_file)

    async def __handle_tts(self, encounter_id: str, text: str) -> Dict[str, Any]:
        """Encapsulación de lógica TTS."""
        audio_bytes = await self.__tts_service.text_to_speech(text)
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

    async def __process_standard_audio(self, encounter_id: str, audio_file: UploadFile) -> Dict[str, Any]:
        # Implementación simplificada delegando a STT
        audio_bytes = await audio_file.read()
        stt_result = await self.__stt_service.transcribe_audio(
            audio_bytes, 
            content_type=audio_file.content_type or "audio/wav"
        )
        user_text = stt_result.get("text", "")
        
        # Guardar audio del usuario
        audio_asset = await self.__audio_service.save_audio(encounter_id, audio_bytes, audio_file.content_type)
        
        return await self.process_text_input(
            encounter_id, 
            user_text, 
            include_tts=True, 
            user_audio_url=f"/api/audio/{audio_asset.id}"
        )

    async def __process_unreal_audio(self, encounter_id: str, audio_file: UploadFile) -> Dict[str, Any]:
        # Solo guardar sin procesar flujo de chat (Requerimiento Unreal)
        audio_bytes = await audio_file.read()
        await self.__audio_service.save_audio(encounter_id, audio_bytes, audio_file.content_type)
        return {"ok": True, "mode": "unreal"}

    def __build_response_payload(self, eid: str, text: str, reply: str, msg: Message, audio: Dict) -> Dict[str, Any]:
        """Centralización de la construcción del payload de respuesta."""
        return {
            "encounter_id": eid,
            "user_text": text,
            "reply_text": reply,
            "assistant_message": msg.model_dump(),
            "assistant_audio": audio if audio else None
        }

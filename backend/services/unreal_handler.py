import base64
import logging
from pathlib import Path
from typing import Dict, Any, Optional
from uuid import uuid4

from fastapi import HTTPException

from backend.domain.models import Encounter

logger = logging.getLogger(__name__)

class UnrealAudioHandler:
    """
    Implementation: Manejador especializado para flujos de audio de Unreal Engine.
    Transforma lógica procedural en un objeto con responsabilidades claras.
    Aplica DIP al recibir sus dependencias por constructor.
    """
    
    DEFAULT_CONTENT_TYPE = "audio/wav"
    UNREAL_SUBDIR = Path("backend") / "unreal_audio_uploads"

    def __init__(self, base_dir: Path, encounter_service: Any, audio_orchestrator: Any):
        self.__base_dir = base_dir
        self.__storage_dir = base_dir / self.UNREAL_SUBDIR
        self.__storage_dir.mkdir(parents=True, exist_ok=True)
        self.__encounter_service = encounter_service
        self.__audio_orchestrator = audio_orchestrator

    async def handle_upload(self, audio_bytes: bytes, content_type: Optional[str]) -> Dict[str, Any]:
        """
        Orquestación del flujo Unreal.
        """
        self.__validate_input(audio_bytes)
        
        filename = self.__generate_filename()
        saved_path = self.__persist_audio(audio_bytes, filename)
        
        encounter = await self.__find_active_encounter()
        
        flow_result = await self.__execute_conversation_flow(
            encounter, audio_bytes, content_type or self.DEFAULT_CONTENT_TYPE, filename
        )
        
        return self.__build_response(encounter, saved_path, flow_result)

    def __validate_input(self, data: bytes) -> None:
        if data:
            return
        logger.error("Unreal audio upload rejected: empty body")
        raise HTTPException(status_code=400, detail="Request body is empty")

    def __generate_filename(self) -> str:
        return f"audio-unreal-{uuid4().hex}.wav"

    def __persist_audio(self, data: bytes, filename: str) -> str:
        output_path = self.__storage_dir / filename
        output_path.write_bytes(data)
        return str(self.UNREAL_SUBDIR / filename)

    async def __find_active_encounter(self) -> Encounter:
        encounters = await self.__encounter_service.list_public_encounters()
        active = next((e for e in encounters if e and e.finished_at is None), None)
        
        if active:
            return active
            
        raise HTTPException(status_code=404, detail="No active encounter found")

    async def __execute_conversation_flow(self, encounter: Encounter, data: bytes, ct: str, fname: str) -> Dict[str, Any]:
        try:
            return await self.__audio_orchestrator.process_audio_bytes(
                encounter_id=encounter.encounter_id,
                audio_bytes=data,
                content_type=ct,
                filename=fname,
            )
        except HTTPException as exc:
            raise self.__wrap_http_error(encounter, exc)

    def __build_response(self, encounter: Encounter, path: str, result: Dict[str, Any]) -> Dict[str, Any]:
        assistant_audio = result.get("assistant_audio") or result.get("chat") or {}
        
        return {
            "encounter_id": encounter.encounter_id,
            "saved_path": path,
            "reply_text": result.get("reply_text", ""),
            "assistant_audio": {
                "audio_base64": assistant_audio.get("audio_base64"),
                "content_type": assistant_audio.get("content_type") or self.DEFAULT_CONTENT_TYPE,
            }
        }

    def __wrap_http_error(self, encounter: Encounter, exc: HTTPException) -> HTTPException:
        detail = exc.detail if isinstance(exc.detail, dict) else {"message": str(exc.detail)}
        return HTTPException(
            status_code=exc.status_code,
            detail={"encounter_id": encounter.encounter_id, **detail}
        )

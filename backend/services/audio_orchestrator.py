import base64
import uuid
from typing import Optional, Dict, Any
from fastapi import HTTPException, UploadFile
from backend.core.config import settings
from backend.services.realtime.hub import EncounterRealtimeHub

class AudioOrchestrator:
    def __init__(
        self,
        patient_service,
        encounter_service,
        llm_service,
        stt_service,
        tts_service,
        prompt_service,
        realtime_hub: EncounterRealtimeHub
    ):
        self.patient_service = patient_service
        self.encounter_service = encounter_service
        self.llm_service = llm_service
        self.stt_service = stt_service
        self.tts_service = tts_service
        self.prompt_service = prompt_service
        self.realtime_hub = realtime_hub

    async def process_text_input(self, encounter_id: str, text: str, include_tts: bool = False) -> Dict[str, Any]:
        encounter = await self.encounter_service.get_encounter(encounter_id)
        if not encounter:
            raise HTTPException(status_code=404, detail="Encounter not found")

        patient = await self.patient_service.get_patient_by_id(encounter.patient_id)
        if not patient:
            raise HTTPException(status_code=404, detail="Patient profile not found")

        # 1. Add user message to history
        user_msg = await self.encounter_service.add_message_to_history(encounter_id, "user", text)
        await self.realtime_hub.broadcast(encounter_id, user_msg.model_dump())

        # 2. Prepare LLM prompt (Converting Pydantic objects to LLM-compatible dicts)
        system_prompt = self.prompt_service.build_patient_system_prompt(patient)
        messages = [{"role": "system", "content": system_prompt}]
        for m in encounter.chat_history:
            messages.append({"role": m.role, "content": m.content})
        messages.append({"role": "user", "content": text})

        # 3. Get LLM response
        assistant_text = await self.llm_service.chat_with_model(messages)

        # 4. (Optional) TTS
        audio_base64 = None
        audio_url = None
        if include_tts:
            try:
                audio_bytes = await self.tts_service.text_to_speech(assistant_text)
                audio_base64 = base64.b64encode(audio_bytes).decode("ascii")
                
                audio_filename = f"{uuid.uuid4().hex}.wav"
                encounter_audio_dir = settings.audio_path / encounter_id
                encounter_audio_dir.mkdir(parents=True, exist_ok=True)
                
                with open(encounter_audio_dir / audio_filename, "wb") as f:
                    f.write(audio_bytes)
                audio_url = f"/api/audio/{encounter_id}/{audio_filename}"
            except Exception as e:
                print(f"TTS Error: {e}") # Non-blocking for the chat

        # 5. Add assistant message to history
        assistant_msg = await self.encounter_service.add_message_to_history(encounter_id, "assistant", assistant_text, audio_url=audio_url)
        await self.realtime_hub.broadcast(encounter_id, assistant_msg.model_dump())

        return {
            "chat": {
                "text": assistant_text,
                "audio_url": audio_url,
                "audio_base64": audio_base64
            },
            "user_message": user_msg.model_dump(),
            "assistant_message": assistant_msg.model_dump()
        }

    async def process_audio_input(self, encounter_id: str, audio_file: UploadFile) -> Dict[str, Any]:
        audio_bytes = await audio_file.read()
        stt_result = await self.stt_service.transcribe_audio(audio_bytes, content_type=audio_file.content_type)
        user_text = stt_result.get("text", "")
        return await self.process_text_input(encounter_id, user_text, include_tts=True)

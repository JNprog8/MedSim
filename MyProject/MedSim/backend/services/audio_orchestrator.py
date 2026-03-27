import base64
from typing import Optional, Dict, Any
from fastapi import HTTPException, UploadFile
from backend.services.realtime.hub import EncounterRealtimeHub

class AudioOrchestrator:
    def __init__(
        self,
        patient_service,
        encounter_service,
        audio_service,
        llm_service,
        stt_service,
        tts_service,
        prompt_service,
        realtime_hub: EncounterRealtimeHub
    ):
        self.patient_service = patient_service
        self.encounter_service = encounter_service
        self.audio_service = audio_service
        self.llm_service = llm_service
        self.stt_service = stt_service
        self.tts_service = tts_service
        self.prompt_service = prompt_service
        self.realtime_hub = realtime_hub

    async def process_text_input(
        self,
        encounter_id: str,
        text: str,
        include_tts: bool = False,
        user_audio_url: Optional[str] = None,
    ) -> Dict[str, Any]:
        encounter = await self.encounter_service.get_encounter(encounter_id)
        if not encounter:
            raise HTTPException(status_code=404, detail="Encounter not found")

        patient = await self.patient_service.get_patient_by_id(encounter.patient_id)
        if not patient:
            raise HTTPException(status_code=404, detail="Patient profile not found")

        # 1. Add user message to history
        user_msg = await self.encounter_service.add_message_to_history(
            encounter_id,
            "user",
            text,
            audio_url=user_audio_url,
        )
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
        content_type = None
        if include_tts:
            try:
                audio_bytes = await self.tts_service.text_to_speech(assistant_text)
                audio_base64 = base64.b64encode(audio_bytes).decode("ascii")
                audio_asset = await self.audio_service.save_audio(
                    encounter_id=encounter_id,
                    audio_bytes=audio_bytes,
                    content_type="audio/wav",
                )
                audio_url = f"/api/audio/{audio_asset.id}"
                content_type = "audio/wav"
            except Exception as e:
                print(f"TTS Error: {e}") # Non-blocking for the chat

        # 5. Add assistant message to history
        assistant_msg = await self.encounter_service.add_message_to_history(encounter_id, "assistant", assistant_text, audio_url=audio_url)
        await self.realtime_hub.broadcast(encounter_id, assistant_msg.model_dump())

        unified_audio = {
            "audio_url": audio_url,
            "audio_base64": audio_base64,
            "content_type": content_type,
        } if (audio_url or audio_base64) else None

        return {
            "encounter_id": encounter_id,
            "user_text": text,
            "reply_text": assistant_text,
            "transcript": {
                "text": text,
            },
            "assistant_reply": {
                "text": assistant_text,
                "message_id": assistant_msg.message_id,
            },
            "assistant_audio": unified_audio,
            "chat": {
                "text": assistant_text,
                "audio_url": audio_url,
                "audio_base64": audio_base64,
                "content_type": content_type,
            },
            "user_message": user_msg.model_dump(),
            "assistant_message": assistant_msg.model_dump(),
        }

    async def process_audio_input(self, encounter_id: str, audio_file: UploadFile) -> Dict[str, Any]:
        audio_bytes = await audio_file.read()
        content_type = audio_file.content_type or "audio/wav"
        user_audio = await self.audio_service.save_audio(
            encounter_id=encounter_id,
            audio_bytes=audio_bytes,
            content_type=content_type,
        )
        stt_result = await self.stt_service.transcribe_audio(audio_bytes, content_type=audio_file.content_type)
        user_text = stt_result.get("text", "")
        return await self.process_text_input(
            encounter_id,
            user_text,
            include_tts=True,
            user_audio_url=f"/api/audio/{user_audio.id}",
        )

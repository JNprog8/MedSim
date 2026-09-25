import pytest
from unittest.mock import AsyncMock, MagicMock
from backend.services.audio_orchestrator import AudioOrchestrator


@pytest.fixture
def mock_orchestrator():
    patient_service = MagicMock()
    encounter_service = MagicMock()
    audio_service = MagicMock()
    llm_service = MagicMock()
    stt_service = MagicMock()
    tts_service = MagicMock()
    prompt_service = MagicMock()
    realtime_hub = MagicMock()

    orchestrator = AudioOrchestrator(
        patient_service=patient_service,
        encounter_service=encounter_service,
        audio_service=audio_service,
        llm_service=llm_service,
        stt_service=stt_service,
        tts_service=tts_service,
        prompt_service=prompt_service,
        realtime_hub=realtime_hub,
    )
    return orchestrator, stt_service, llm_service


@pytest.mark.anyio
async def test_process_text_input_empty_is_ignored(mock_orchestrator):
    orchestrator, _, llm_service = mock_orchestrator
    result = await orchestrator.process_text_input("enc_123", "   ")
    assert result["ignored"] is True
    assert result["reason"] == "empty_text"
    assert result["assistant_message"] is None
    llm_service.chat_with_model.assert_not_called()


@pytest.mark.anyio
async def test_process_audio_bytes_too_short_is_ignored(mock_orchestrator):
    orchestrator, stt_service, llm_service = mock_orchestrator
    # 50 bytes of audio is too short
    result = await orchestrator.process_audio_bytes("enc_123", b"RIFF" + b"\x00" * 46)
    assert result["ignored"] is True
    assert result["reason"] == "audio_too_short"
    stt_service.transcribe_audio.assert_not_called()
    llm_service.chat_with_model.assert_not_called()


@pytest.mark.anyio
async def test_process_audio_bytes_silent_transcription_is_ignored(mock_orchestrator):
    orchestrator, stt_service, llm_service = mock_orchestrator
    stt_service.transcribe_audio = AsyncMock(return_value={"text": "   ... ?  "})
    # ~2000 bytes
    result = await orchestrator.process_audio_bytes("enc_123", b"\x00" * 2000)
    assert result["ignored"] is True
    assert result["reason"] == "no_speech_detected"
    llm_service.chat_with_model.assert_not_called()


@pytest.mark.anyio
async def test_llm_failure_falls_back_to_did_not_hear_well(mock_orchestrator):
    orchestrator, _, llm_service = mock_orchestrator
    llm_service.chat_with_model = AsyncMock(side_effect=Exception("Groq 429 Rate Limit"))
    
    mock_encounter = MagicMock()
    mock_encounter.patient_id = "patient_123"
    mock_encounter.get_llm_context.return_value = []
    mock_msg = MagicMock()
    mock_msg.model_dump.return_value = {"role": "assistant", "content": "Disculpe, doctor, no lo escuché bien. ¿Me podría repetir?"}
    mock_encounter.add_message.return_value = mock_msg

    orchestrator._AudioOrchestrator__encounter_service.get_encounter = AsyncMock(return_value=mock_encounter)
    orchestrator._AudioOrchestrator__patient_service.get_patient_by_id = AsyncMock(return_value=MagicMock())
    orchestrator._AudioOrchestrator__prompt_service.build_patient_system_prompt.return_value = "system prompt"
    orchestrator._AudioOrchestrator__encounter_service.repository.upsert = AsyncMock()
    orchestrator._AudioOrchestrator__realtime_hub.broadcast = AsyncMock()

    result = await orchestrator.process_text_input("enc_123", "¿Cómo te sentís?")
    assert "no lo escuché bien" in result["reply_text"]



import sys
import os
import asyncio
import io
import wave
import aiohttp
from dotenv import load_dotenv

sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))
load_dotenv(".env", override=True)

from backend.services.stt_service import STTService

def create_valid_wav() -> bytes:
    buf = io.BytesIO()
    with wave.open(buf, 'wb') as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(16000)
        wf.writeframes(b'\x00' * 32000)
    return buf.getvalue()

async def test_stt_whisper1():
    print("--- Testing Groq STT with 'whisper-1' ---")
    stt = STTService()
    stt.model = "whisper-1" # Force the default fallback
    audio_bytes = create_valid_wav()
    try:
        res = await stt.transcribe_audio(audio_bytes, content_type="audio/wav")
        print(f"STT OK: {res}")
    except Exception as e:
        print(f"STT Error: {type(e).__name__} - {e}")

if __name__ == "__main__":
    asyncio.run(test_stt_whisper1())

import sys
import os
import asyncio
import aiohttp
from openai import AsyncOpenAI
from dotenv import load_dotenv

sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))
load_dotenv(".env")

async def test_models():
    # Test LLM
    llm_url = os.environ.get("PATIENT_LLM_URL", "https://api.openai.com/v1")
    llm_key = os.environ.get("PATIENT_LLM_API_KEY")
    llm_model = os.environ.get("PATIENT_LLM_MODEL", "gpt-4-turbo")
    
    print(f"Testing LLM model '{llm_model}' on {llm_url}...")
    try:
        client = AsyncOpenAI(api_key=llm_key, base_url=llm_url)
        await client.chat.completions.create(
            model=llm_model,
            messages=[{"role": "user", "content": "Hi"}],
            max_tokens=10
        )
        print("LLM: OK")
    except Exception as e:
        print(f"LLM Error: {e}")

    # Test STT model via Groq / OpenAI compatible
    stt_url = os.environ.get("STT_API_URL", "https://api.openai.com/v1")
    stt_key = os.environ.get("STT_API_KEY")
    stt_model = os.environ.get("STT_MODEL", "whisper-large-v3")
    
    print(f"\nTesting STT model '{stt_model}' on {stt_url}...")
    try:
        client = AsyncOpenAI(api_key=stt_key, base_url=stt_url)
        # Just listing models or making a basic request
        # If it's groq, we can just list models and see if whisper-large-v3 is there
        models = await client.models.list()
        model_ids = [m.id for m in models.data]
        if stt_model in model_ids:
            print(f"STT: OK (Model '{stt_model}' is listed in available models)")
        else:
            print(f"STT Error: Model '{stt_model}' not found in available models! Available: {', '.join(model_ids)}")
    except Exception as e:
        print(f"STT Error: {e}")

if __name__ == "__main__":
    asyncio.run(test_models())

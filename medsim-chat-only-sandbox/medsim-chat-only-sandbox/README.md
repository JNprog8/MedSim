# MedSim Sandbox

Sandbox local para practicar entrevistas medico-paciente con un paciente simulado.

- Chat: usa un backend LLM OpenAI-compatible (Ollama, Gemini OpenAI-compatible, vLLM, etc).
- Audio: STT y TTS via APIs configurables desde el backend.

## Que incluye

- App `FastAPI` con UI web.
- Pacientes de ejemplo en `patients/`.
- Panel clinico (ficha) y checklist manual `SEGUE`.
- Soporte para backends LLM OpenAI-compatible.
- STT via API (OpenAI-compatible o Gemini nativo segun `STT_API_URL`).
- TTS via API (Cartesia / ElevenLabs / OpenAI-compatible segun `TTS_API_URL`).

## Estructura

```text
medsim-chat-only-sandbox/
|- main.py
|- api.py
|- services/
|- domain/
|- templates/
|- static/
|- patients/
|- Dockerfile
|- docker-compose.yml
`- requirements.txt
```

## Requisitos

- Python 3.12+

Opcional:

- Ollama (si queres LLM local)

## Instalacion

```powershell
cd C:\Users\Maxi\PycharmProjects\MedSim\MedSim\medsim-chat-only-sandbox
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

## Como levantar la app

```powershell
cd C:\Users\porre\IdeaProjects\MedSim\medsim-chat-only-sandbox
.\.venv\Scripts\python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port 8001
```

Abrir:

- `http://127.0.0.1:8001`

## Configuracion (LLM / STT / TTS)

La configuracion vive en el backend y se carga desde `.env` al arrancar.

La UI ya no empuja configuracion de proveedores al servidor. Solo consulta `GET /api/config_state`
para saber si audio y modelos quedaron configurados correctamente.

Variables de entorno soportadas:

- LLM:
  - `PATIENT_LLM_URL`, `PATIENT_LLM_API_KEY`, `PATIENT_LLM_MODEL`
  - `OLLAMA_URL` (fallback)
- STT:
  - `STT_API_URL`, `STT_API_KEY`, `STT_MODEL`
- TTS:
  - `TTS_API_URL`, `TTS_API_KEY`, `TTS_VOICE_ID`, `TTS_MODEL_ID`, `TTS_LANGUAGE`

Ejemplo rapido:

```env
PATIENT_LLM_URL=https://generativelanguage.googleapis.com/v1beta/openai
PATIENT_LLM_API_KEY=replace_me
PATIENT_LLM_MODEL=gemini-2.0-flash

STT_API_URL=https://api.groq.com/openai/v1
STT_API_KEY=replace_me
STT_MODEL=whisper-large-v3

TTS_API_URL=https://api.cartesia.ai
TTS_API_KEY=replace_me
TTS_VOICE_ID=replace_me
TTS_MODEL_ID=sonic
TTS_LANGUAGE=es
```

## Documentacion

- HUs: `docs/HU-00-index.md`
- Code tour: `docs/CODIGO-00-index.md`


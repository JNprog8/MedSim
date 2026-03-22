# MedSim Sandbox

Sandbox local para practicar entrevistas médico-paciente con un paciente simulado.

- Chat: usa un backend LLM OpenAI-compatible (Ollama, Gemini OpenAI-compatible, vLLM, etc).
- Audio: STT y TTS via APIs configurables desde el backend.

## Qué incluye

- App `FastAPI` con UI web.
- Pacientes de ejemplo en `patients/`.
- Panel clínico (ficha) y checklist manual `SEGUE`.
- Soporte para backends LLM OpenAI-compatible.
- STT via API (OpenAI-compatible o Gemini nativo según `STT_API_URL`).
- TTS via API (Cartesia / ElevenLabs / OpenAI-compatible según `TTS_API_URL`).

## Estructura

```text
MedSim/
|- backend/
|- frontend/
|- static/
|- patients/
|- students/
|- audio/
|- encounters/
|- Dockerfile
|- docker-compose.yml
|- requirements.txt
`- README.md
```

## Requisitos

- Python 3.12+

Opcional:

- Ollama (si querés LLM local)

## Instalación

### 🐧 Linux / macOS

#### 1. Crear el entorno virtual

```bash
python3.12 -m venv .venv
```

#### 2. Activar el entorno virtual

```bash
source .venv/bin/activate
```

#### 3. Actualizar pip y herramientas

```bash
pip install --upgrade pip setuptools wheel
```

#### 4. Instalar dependencias

```bash
pip install -r requirements.txt
```

---

### 🪟 Windows (PowerShell)

#### 1. Crear el entorno virtual

```powershell
python -m venv .venv
```

#### 2. Activar el entorno virtual

```powershell
.\.venv\Scripts\Activate.ps1
```

> **Nota:** Si obtienes un error de política de ejecución, ejecuta:
> ```powershell
> Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
> ```

#### 3. Actualizar pip y herramientas

```powershell
python -m pip install --upgrade pip setuptools wheel
```

#### 4. Instalar dependencias

```powershell
pip install -r requirements.txt
```

---

## Cómo levantar la aplicación

### 🐧 Linux / macOS

#### 1. Activar el entorno virtual

```bash
source .venv/bin/activate
```

#### 2. Ejecutar el servidor con uvicorn

```bash
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

#### 3. Abrir la aplicación

- Acceso local: `http://localhost:8000`
- Acceso en red: `http://<tu-ip>:8000`

---

### 🪟 Windows (PowerShell)

#### 1. Activar el entorno virtual

```powershell
.\.venv\Scripts\Activate.ps1
```

#### 2. Ejecutar el servidor con uvicorn

```powershell
uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
```

#### 3. Abrir la aplicación

- `http://127.0.0.1:8000`

---

## Opciones de uvicorn

| Opción | Descripción |
|--------|-------------|
| `--reload` | Recarga automática al detectar cambios (desarrollo) |
| `--host 0.0.0.0` | Accesible desde cualquier interfaz (Linux/macOS) |
| `--host 127.0.0.1` | Solo acceso local (Windows) |
| `--port 8000` | Puerto en el que se ejecuta el servidor |

---

## Health Check

Verifica que el servidor está corriendo:

```bash
curl http://localhost:8000/health
```

Respuesta esperada:
```json
{"status":"ok","timestamp":1774219982.1558745}
```

## Configuración (LLM / STT / TTS)

La configuración vive en el backend y se carga desde `.env` al arrancar.

La UI ya no empuja configuración de proveedores al servidor. Solo consulta `GET /api/config_state`
para saber si audio y modelos quedaron configurados correctamente.

### Variables de entorno soportadas

#### 🤖 LLM (Language Model)
- `PATIENT_LLM_URL` - URL del servicio LLM
- `PATIENT_LLM_API_KEY` - API key del servicio
- `PATIENT_LLM_MODEL` - Modelo a usar
- `OLLAMA_URL` - (fallback) URL de Ollama si está disponible

#### 🎤 STT (Speech-to-Text)
- `STT_API_URL` - URL del servicio STT
- `STT_API_KEY` - API key del servicio
- `STT_MODEL` - Modelo de transcripción

#### 🔊 TTS (Text-to-Speech)
- `TTS_API_URL` - URL del servicio TTS
- `TTS_API_KEY` - API key del servicio
- `TTS_VOICE_ID` - ID de la voz a usar
- `TTS_MODEL_ID` - ID del modelo
- `TTS_LANGUAGE` - Idioma (ej: es, en, fr)

### Ejemplo de configuración rápida

Crear un archivo `.env` en la raíz del proyecto:

```env
# LLM - Gemini OpenAI-compatible
PATIENT_LLM_URL=https://generativelanguage.googleapis.com/v1beta/openai
PATIENT_LLM_API_KEY=your_gemini_api_key
PATIENT_LLM_MODEL=gemini-2.0-flash

# STT - Groq Whisper
STT_API_URL=https://api.groq.com/openai/v1
STT_API_KEY=your_groq_api_key
STT_MODEL=whisper-large-v3

# TTS - Cartesia
TTS_API_URL=https://api.cartesia.ai
TTS_API_KEY=your_cartesia_api_key
TTS_VOICE_ID=your_voice_id
TTS_MODEL_ID=sonic
TTS_LANGUAGE=es
```

> **Nota:** Reemplaza `your_*_key` con tus credenciales reales.

---

## Documentación

- HUs: `docs/HU-00-index.md`
- Code tour: `docs/CODIGO-00-index.md`


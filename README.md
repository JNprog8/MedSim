# MedSim Sandbox 🏥

Sandbox local diseñado para practicar entrevistas médico-paciente con un paciente simulado por IA. Permite interactuar mediante chat y voz, integrando servicios de LLM, STT y TTS configurables.

## 🚀 Características Principales

- **Interacción Realista:** Backend LLM compatible con OpenAI (Ollama, Gemini, vLLM).
- **Voz y Audio:** Soporte para STT (Groq/OpenAI) y TTS (Cartesia/ElevenLabs).
- **Gestión Clínica:** Fichas de pacientes, checklists `SEGUE` y evaluaciones automáticas.
- **Docker Ready:** Configuración completa con MongoDB integrada.

---

## 📁 Estructura del Proyecto

- `backend/`: Lógica del servidor (FastAPI), servicios y dominio.
- `frontend/`: Interfaz de usuario (HTML/JS/CSS).
- `storage/`: Datos persistentes (pacientes, encuentros, audios y evaluaciones).
- `logs/`: Archivos temporales y registros del sistema (ignorado por Git).
- `docs/`: Documentación detallada de Historias de Usuario (HUs).

---

## 🛠️ Requisitos Previos

- **Python 3.12+**
- **Docker & Docker Compose** (Recomendado para la base de datos MongoDB).
- **Ollama** (Opcional, para ejecución de LLM local).

---

## 🏃 Cómo Levantar el Proyecto

### Opción A: Usando Docker (Recomendado)

Ideal para tener todo configurado (Base de Datos + Backend) en un solo comando.

1. **Levantar contenedores:**
   ```bash
   docker-compose up -d
   ```
2. **Acceder a la UI:**
   - Index: [http://localhost:8080/frontend/index](http://localhost:8080/frontend/index)

---

### Opción B: Ejecución Local (Desarrollo)

Si prefieres ejecutar el backend manualmente fuera de Docker.

#### 1. Instalación de Dependencias

**En Linux / macOS:**
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

**En Windows (PowerShell):**
```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

#### 2. Iniciar el Backend

**En Linux / macOS:**
```bash
uvicorn backend.main:app --host 127.0.0.1 --port 8001 --reload
```

**En Windows (PowerShell):**
```powershell
.\.venv\Scripts\python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port 8001 --reload
```

---

## ⚙️ Configuración (LLM / STT / TTS)

La configuración se realiza directamente desde la **UI (sidebar)** o mediante **variables de entorno** en el archivo `.env` o `docker-compose.yml`.

### Variables de Entorno Soportadas:
- **LLM:** `PATIENT_LLM_URL`, `PATIENT_LLM_API_KEY`, `PATIENT_LLM_MODEL`.
- **STT:** `STT_API_URL`, `STT_API_KEY`, `STT_MODEL`.
- **TTS:** `TTS_API_URL`, `TTS_API_KEY`, `TTS_VOICE_ID`, `TTS_MODEL_ID`, `TTS_LANGUAGE`.

### Ejemplos de Configuración en la UI:
- **LLM (Gemini):** `base_url: https://generativelanguage.googleapis.com/v1beta/openai`
- **STT (Groq):** `base_url: https://api.groq.com/openai/v1`, `model: whisper-large-v3`
- **TTS (Cartesia):** `base_url: https://api.cartesia.ai`, `model_id: sonic`

---

## 🔗 Enlaces de Interés

- **Portal Principal:** `http://localhost:8001/frontend/index`
- **Panel Estudiante:** `http://localhost:8001/frontend/student`
- **Panel Evaluador:** `http://localhost:8001/frontend/evaluator`

---

## 📄 Documentación Adicional
- [Historias de Usuario (HUs)](docs/HU-00-index.md)
- [Guía de Código (Code Tour)](docs/CODIGO-00-index.md)

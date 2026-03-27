# Guia de Arranque de MedSim

Este proyecto hoy corre con:

- `FastAPI`
- `MongoDB`
- frontend estatico servido por el backend
- bootstrap automatico de datos demo en Mongo al iniciar

El backend levanta:

- un paciente demo
- un estudiante demo

si no existen todavia en la base.

## Requisitos

- Python `3.12+`
- MongoDB corriendo en `localhost:27017` o una `MONGO_URL` valida
- archivo [`.env`](c:/Users/Maxi/Desktop/MedSim/.env) configurado

## 1. Crear `.env`

Copiá el ejemplo:

```powershell
Copy-Item .env.example .env
```

Configuracion minima recomendada:

```env
MONGO_URL=mongodb://localhost:27017/medsim
MONGO_DB_NAME=medsim

PATIENT_LLM_URL=https://generativelanguage.googleapis.com/v1beta/openai/
PATIENT_LLM_API_KEY=TU_API_KEY
PATIENT_LLM_MODEL=gemini-2.5-flash

STT_API_URL=https://api.groq.com/openai/v1/
STT_API_KEY=TU_API_KEY
STT_MODEL=whisper-large-v3

TTS_API_URL=https://api.cartesia.ai/
TTS_API_KEY=TU_API_KEY
TTS_VOICE_ID=TU_VOICE_ID
TTS_MODEL_ID=sonic
TTS_LANGUAGE=es

PORT=8001
DEBUG=True
```

Notas:

- `PORT` del `.env` solo aplica si corrés `python -m backend.main`
- si levantás con `uvicorn ... --port 8000`, manda el puerto del comando
- para pruebas locales del repo, hoy estamos usando `8000`

## 2. Levantar MongoDB

Si lo tenés instalado localmente, asegurate de que esté corriendo.

Si querés levantarlo rápido con Docker:

```powershell
docker run -d --name medsim-mongo -p 27017:27017 mongo
```

## 3. Crear entorno virtual

### Windows

```powershell
cd C:\Users\Maxi\Desktop\MedSim
python -m venv .venv
```

Si PowerShell no te deja activar scripts, no hace falta activar nada: podés usar directamente el `python.exe` del entorno.

## 4. Instalar dependencias

### Windows

```powershell
cd C:\Users\Maxi\Desktop\MedSim
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

### Linux / macOS

```bash
cd /ruta/a/MedSim
python3.12 -m venv .venv
.venv/bin/python -m pip install --upgrade pip
.venv/bin/python -m pip install -r requirements.txt
```

## 5. Arrancar la app

### Windows

```powershell
cd C:\Users\Maxi\Desktop\MedSim
.\.venv\Scripts\python.exe -m uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
```

### Linux / macOS

```bash
cd /ruta/a/MedSim
.venv/bin/python -m uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
```

## 6. URLs utiles

Con el comando anterior:

- Inicio: `http://127.0.0.1:8000/frontend/index`
- Alumno: `http://127.0.0.1:8000/frontend/student`
- Alumno join: `http://127.0.0.1:8000/frontend/student_join`
- Sesiones alumno: `http://127.0.0.1:8000/frontend/student_sessions`
- Evaluador: `http://127.0.0.1:8000/frontend/evaluator`
- Encounter evaluador: `http://127.0.0.1:8000/frontend/evaluator_encounter?encounter_id=...`
- Pacientes: `http://127.0.0.1:8000/frontend/patients`
- Estudiantes: `http://127.0.0.1:8000/frontend/students`

## 7. Que deberias ver al arrancar

En consola deberias ver algo parecido a:

```text
Conectado a MongoDB: mongodb://localhost:27017/medsim
Paciente demo asegurado: ...
Alumno demo asegurado: ...
Application startup complete.
```

## 8. Verificaciones utiles

Estado de configuracion:

```text
http://127.0.0.1:8000/api/config_state
```

Sesiones publicas:

```text
http://127.0.0.1:8000/api/encounters_public
```

Catalogo SEGUE:

```text
http://127.0.0.1:8000/api/evaluations/catalog
```

## 9. Problemas comunes

### PowerShell bloquea `Activate.ps1`

Usá directamente:

```powershell
.\.venv\Scripts\python.exe -m uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
```

### Falta una libreria del entorno virtual

Reinstalá dependencias:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

### Mongo autentica mal

Si tu Mongo local no usa usuario/clave, asegurate de tener:

```env
MONGO_URL=mongodb://localhost:27017/medsim
```

### El texto funciona pero el audio no

Revisá:

- `STT_API_KEY`
- `TTS_API_KEY`
- `TTS_VOICE_ID`
- `/api/config_state`

## 10. Estado actual del proyecto

Importante:

- pacientes y estudiantes viven en MongoDB
- los audios viven en MongoDB
- las evaluaciones SEGUE viven en MongoDB
- ya no dependemos de carpetas `patients/` ni `students/`
- el frontend consume endpoints enriquecidos desde backend para sesiones y evaluaciones

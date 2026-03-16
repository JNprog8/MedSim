# Gestión de Dependencias - MedSim

Este documento detalla las librerías utilizadas en el proyecto y su propósito. Se han actualizado a versiones estables para evitar conflictos de compatibilidad.

## Librerías Principales

- **fastapi (0.110.3)**: Framework web moderno y rápido para construir APIs con Python basado en anotaciones de tipo estándar.
- **uvicorn (0.29.0)**: Servidor ASGI para Python, diseñado para ser rápido y eficiente.
- **pydantic (2.6.4)**: Validación de datos y gestión de configuraciones utilizando anotaciones de tipo de Python.
- **pydantic-settings (2.2.1)**: Extensión de Pydantic para manejar variables de entorno y archivos `.env` de forma tipada y segura.
- **openai (1.14.3)**: Cliente oficial para interactuar con modelos de OpenAI y cualquier backend compatible (Ollama, vLLM, Gemini-OpenAI).
- **python-dotenv (1.0.1)**: Permite cargar variables de entorno desde archivos `.env`.

## Librerías de Utilidad

- **aiohttp (3.9.3)**: Cliente HTTP asíncrono utilizado para comunicaciones directas con APIs de STT (Gemini) y TTS (ElevenLabs, Cartesia).
- **jinja2 (3.1.3)**: Motor de plantillas para renderizar el frontend (`index.html`).
- **python-multipart (0.0.7)**: Necesario para que FastAPI pueda procesar datos enviados a través de formularios (`Form(...)`) y archivos (`UploadFile`).

## Instalación

Para instalar todas las dependencias en un entorno limpio:

```bash
pip install -r requirements.txt
```

Se recomienda el uso de un entorno virtual (`venv`) para aislar las dependencias del sistema.

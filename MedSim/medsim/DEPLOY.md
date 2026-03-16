# Guía de Despliegue - MedSim

Sigue estos pasos para poner en marcha el simulador.

## Requisitos Previos

- **Python 3.10+** (si se instala localmente).
- **Docker y Docker Compose** (para despliegue en contenedores).
- **Backend LLM**: Ollama corriendo localmente o acceso a la API de OpenAI/Gemini.

---

## 1. Configuración de Variables de Entorno

Antes de arrancar, debes configurar tus secretos:

1. Copia el archivo de ejemplo:
   ```bash
   cp .env.example .env
   ```
2. Edita `.env` y completa las claves necesarias (ej. `STT_API_KEY`, `TTS_API_KEY`). Si usas Ollama local, la
   configuración por defecto debería funcionar.

---

## 2. Despliegue Local (Recomendado para Desarrollo)

1. **Crear Entorno Virtual**:
   ```bash
   python -m venv .venv
   source .venv/bin/activate  # Linux/Mac
   # o .venv\Scripts\activate en Windows
   ```
2. **Instalar Dependencias**:
   ```bash
   pip install -r requirements.txt
   ```
3. **Iniciar el Servidor**:
   ```bash
   uvicorn main:app --reload --port 8000
   ```
4. Accede a `http://localhost:8000`.

---

## 3. Despliegue con Docker (Recomendado para Producción/QA)

1. **Construir y Levantar Contenedores**:
   ```bash
   docker compose up --build -d
   ```
2. Esto levantará el servidor FastAPI en el puerto **8000** (por defecto configurado en `docker-compose.yml`).
3. Para ver los logs:
   ```bash
   docker compose logs -f
   ```

---

## 4. Configuración Post-Arranque

Una vez iniciada la aplicación:

1. Ve a la sección de **Configuración** en la interfaz web.
2. Verifica que el **LLM Health** esté en verde.
3. Asegúrate de que los servicios de **STT** y **TTS** estén configurados correctamente con sus respectivas API Keys si
   vas a usar voz.

---

## Solución de Problemas

- **Ollama no se conecta**: Si usas Docker en Linux, asegúrate de que la URL de Ollama sea `http://172.17.0.1:11434` o
  usa el host IP real de tu máquina. En Windows/Mac, `http://host.docker.internal:11434` debería funcionar.
- **Error de base de datos**: Asegúrate de tener permisos de escritura en la carpeta raíz para crear el archivo
  `medsim.db`.

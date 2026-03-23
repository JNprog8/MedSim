# 🏥 Guía de Arranque de MedSim

Para levantar el sistema de simulación médica con el nuevo backend, sigue estos pasos.

### 📋 Requisitos Previos

1. **Python 3.10+** instalado.
2. **MongoDB** corriendo (Localmente o vía Docker).
    - *Si usas Docker:* `docker run -d -p 27017:27017 --name mongodb mongo`
3. Archivo **.env** configurado (copia `.env.example` y pon tus API Keys).

---

### 🐧 Instrucciones para LINUX

1. Abre una terminal en la carpeta raíz del proyecto.
2. Crea un entorno virtual (si no lo tienes):
   ```bash
   python3.12 -m venv .venv
   ```
3. Activa el entorno virtual:
   ```bash
   source .venv/bin/activate
   ```
4. Instala las dependencias:
   ```bash
   pip install -r requirements.txt
   ```
5. Arranca el sistema:
   ```bash
   python3 -m backend.main
   ```

---

### 🪟 Instrucciones para WINDOWS

1. Abre una terminal (PowerShell o CMD) en la carpeta raíz.
2. Crea un entorno virtual:
   ```bash
   python -m venv .venv
   ```
3. Activa el entorno virtual:
    - *PowerShell:* `.\.venv\Scripts\Activate.ps1`
    - *CMD:* `.\.venv\Scripts\activate.bat`
4. Instala las dependencias:
   ```bash
   pip install -r requirements.txt
   ```
5. Arranca el sistema:
   ```bash
   python -m backend.main
   ```

---

### 🌐 Acceso al Sistema

Una vez arrancado, abre tu navegador en:

- **Panel Principal:** [http://localhost:8001/](http://localhost:8001/)
- **Interfaz Alumno:** [http://localhost:8001/frontend/student](http://localhost:8001/frontend/student)
- **Panel Evaluador:** [http://localhost:8001/frontend/evaluator](http://localhost:8001/frontend/evaluator)

---
*Nota: Si prefieres usar Docker para todo el sistema, asegúrate de actualizar el `docker-compose.yml` para incluir el
servicio de MongoDB.*

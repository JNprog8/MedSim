# MedSim - Documentación

Este documento describe la estructura del proyecto, la responsabilidad de cada carpeta y la funcionalidad de sus
archivos clave.

---

## 🏗️ Resumen

El proyecto sigue un patrón de **Arquitectura de Servicios** con una capa de *Separation of Concerns* (separación de
preocupaciones), donde:

1. **Transporte (API)**: FastAPI maneja las peticiones.
2. **Negocio (Services)**: Lógica de IA, audio y gestión de pacientes.
3. **Datos (Domain/Database)**: Esquemas de Pydantic y persistencia SQLite/JSON.

---

## 📂 Directorio Raíz: `/medsim-fast`

Contiene orquestación global + configuración del entorno.

| Archivo              | Funcionalidad                                                                           |
|:---------------------|:----------------------------------------------------------------------------------------|
| `main.py`            | **Punto de Entrada**. Inicializa FastAPI, monta estáticos y registra las rutas.         |
| `api.py`             | **Controlador de Rutas**. Define los endpoints HTTP y delega la lógica a los servicios. |
| `requirements.txt`   | **Dependencias**. Listado de librerías con versiones bloqueadas para estabilidad.       |
| `.env.example`       | **Plantilla de Secretos**. Guía para configurar API Keys sin exponerlas.                |
| `Dockerfile`         | Receta para construir la imagen del contenedor del servidor.                            |
| `docker-compose.yml` | Orquestador de contenedores (Servidor + DB + Volúmenes).                                |
| `medsim.db`          | Base de datos SQLite (Generada automáticamente) para el historial de chats.             |

---

## 📂 Capa de Negocio: `/services`

Aquí se procesa la lógica.

| Archivo                | Funcionalidad                                                                        |
|:-----------------------|:-------------------------------------------------------------------------------------|
| `container.py`         | **Inyector de Dependencias**. Centraliza la instancia de todos los servicios.        |
| `settings.py`          | **Configuración Tipada**. Carga y valida el archivo `.env` mediante Pydantic.        |
| `llm_service.py`       | Gestiona la conexión con el LLM (OpenAI/Ollama). Maneja modelos y salud del backend. |
| `patient_service.py`   | Administra los perfiles médicos. Incluye un sistema de **caché en memoria**.         |
| `encounter_service.py` | Orquesta las sesiones médico-paciente y la persistencia de la conversación.          |
| `stt_service.py`       | Procesa el audio recibido para convertirlo en texto (Speech-to-Text).                |
| `tts_service.py`       | Convierte las respuestas de la IA en audio hablado (Text-to-Speech).                 |
| `prompt_service.py`    | Construye las instrucciones (System Prompts) para que la IA actúe como el paciente.  |
| `database_service.py`  | Capa de abstracción para consultas SQL a la base de datos local.                     |
| `utils.py`             | Funciones auxiliares transversales (normalización de URLs, sugerencias).             |

---

## 📂 Capa de Dominio: `/domain`

Define los objetos de negocio.

- **`models.py`**: Contiene los esquemas de **Pydantic**. Define la estructura de `PatientProfile`, asegurando que los
  datos de los JSON coincidan con lo que la app espera.

---

## 📂 Interfaz y Estáticos: `/static` y `/templates`

Componentes Frontend.

- **`/templates/index.html`**: Estructura de la SPA (Single Page Application).
- **`/static/script.js`**: Maneja la interactividad: grabación de audio, llamadas a la API y UI dinámica.
- **`/static/styles.css`**: Diseño visual y experiencia de usuario.

---

## 📂 Datos de Pacientes: `/patients`

Almacenamiento persistente de casos médicos.

- **`*.json`**: Cada archivo es un "caso clínico". El sistema los carga dinámicamente, permitiendo añadir nuevos
  pacientes sin tocar el código.

---

## 📂 Documentación de Soporte

Archivos para el equipo.

- **`DEPENDENCIES.md`**: Por qué usamos cada librería y cómo gestionarlas.
- **`DEPLOY.md`**: Guía paso a paso para despliegue local y en la nube.
- **`SUGERENCIAS.md`**: Roadmap con ideas para mejorar la seguridad y escalabilidad.

---
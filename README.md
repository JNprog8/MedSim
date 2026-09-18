# MedSim

Simulador de entrevistas médico-paciente con un paciente de inteligencia artificial, conversación por texto y audio, y evaluación de habilidades de comunicación con el marco SEGUE.

## Qué incluye

- Frontend React + TypeScript + Vite, servido por FastAPI.
- Gestión de pacientes, estudiantes y encuentros, con evaluación SEGUE.
- Chat con proveedores compatibles con la API de OpenAI.
- Transcripción de voz (STT) y generación de audio (TTS) mediante APIs configurables.
- Actualizaciones en tiempo real mediante WebSocket.
- Persistencia de pacientes, estudiantes, encuentros, evaluaciones y audios en MongoDB.
- Endpoint de audio para integrar un cliente Unreal Engine.

## Estado del despliegue

| Área | Estado actual |
|---|---|
| Docker | Build de frontend y backend en una imagen; Compose incluye MongoDB, healthchecks y volumen de datos. |
| Entorno | Configuración central en `.env`, documentada en `.env.example`, consumida por Compose y el backend. |
| Producción | Base de despliegue disponible, con pendientes detallados más abajo. |
| APK Android | No hay proyecto Android, firma ni proceso de generación o publicación de APK/AAB. |
| Automatización | No hay pipeline de CI/CD incluido. |

## Estructura

```text
MedSim/
├── backend/             # API, servicios, dominio y persistencia
├── frontend/            # Aplicación React
├── docs/                # Arquitectura, historias de usuario y capacitación
├── .env.example         # Plantilla de configuración
├── .dockerignore
├── Dockerfile
├── docker-compose.yml
├── requirements.txt
└── README.md
```

## 1. Configurar el entorno

Ejecutá los comandos desde la raíz del repositorio. Si todavía no tenés `.env`, copiá la plantilla:

**Windows (PowerShell):**

```powershell
Copy-Item .env.example .env
```

**Linux / macOS:**

```bash
cp .env.example .env
```

Completá `MONGO_ROOT_PASSWORD` y las claves, URLs y modelos de tu proveedor. Compose rechaza una contraseña raíz vacía. La plantilla incluye ejemplos de Groq para LLM/STT y Cartesia para TTS; ajustalos a tu cuenta. `.env` está excluido de Git y del contexto de Docker.

| Variables | Uso |
|---|---|
| `MONGO_URL` | URI de MongoDB. Compose la reemplaza por la conexión interna. |
| `MONGO_DB_NAME` | Nombre de la base; por defecto, `medsim`. |
| `MONGO_USER`, `MONGO_PASSWORD` | Credenciales locales que el backend agrega si la URI no las incluye. En Docker se sustituyen por las credenciales raíz configuradas. |
| `DOCKER_MONGO_URL`, `MONGO_ROOT_USERNAME`, `MONGO_ROOT_PASSWORD` | URI interna sin credenciales y credenciales de Mongo para Compose. |
| `PATIENT_LLM_URL`, `PATIENT_LLM_API_KEY`, `PATIENT_LLM_MODEL` | Proveedor y modelo del paciente IA. |
| `OLLAMA_URL` | URL alternativa para Ollama, accesible desde el backend. |
| `STT_API_URL`, `STT_API_KEY`, `STT_MODEL` | Servicio de transcripción. |
| `TTS_API_URL`, `TTS_API_KEY`, `TTS_VOICE_ID`, `TTS_MODEL_ID` | Servicio de síntesis de voz. |
| `TTS_LANGUAGE`, `TTS_SPEED`, `TTS_TEMPERATURE` | Idioma y ajustes de voz. |
| `PROJECT_NAME` | Título de la API; por defecto, `MedSim`. |
| `HOST`, `PORT`, `DEBUG` | Interfaz, puerto y recarga del proceso, tanto en Docker como con `python -m backend.run`. |
| `BOOTSTRAP_DEMO` | Activa la creación/reactivación de datos demo; por defecto, `False`. |
| `LOG_LEVEL`, `ACCESS_LOG` | Nivel de logs y registro de accesos de Uvicorn. |
| `PROXY_HEADERS`, `FORWARDED_ALLOW_IPS` | Lectura de encabezados del proxy y orígenes de confianza; no configura HTTPS. |
| `GRACEFUL_TIMEOUT_SECONDS` | Tiempo máximo de cierre ordenado de Uvicorn. |

El backend carga la configuración al arrancar. Reinicialo después de cambiar variables. La UI consulta `/api/config_state` para conocer el estado de configuración, sin recibir las claves.

## 2. Arrancar con Docker

Requiere Docker con Compose y `.env` configurado. No hace falta instalar Node, Python ni MongoDB en el host.

```bash
docker compose up --build -d
docker compose ps
docker compose logs -f app
```

Abrí [MedSim](http://localhost:8000/frontend/index).

### Cómo funciona

1. El stage `frontend-builder`, basado en `node:22-slim`, ejecuta `npm ci` y `npm run build`.
2. La imagen final, basada en `python:3.12-slim`, instala dependencias Python y copia el backend y `frontend/dist`. No incluye Node ni `node_modules` del stage de build.
3. `python -m backend.run` inicia Uvicorn usando `HOST`, `PORT`, `DEBUG` y las opciones de logs/proxy del `.env`. Compose publica `APP_BIND_ADDRESS:APP_HOST_PORT` hacia `PORT`. El ejemplo usa `127.0.0.1:8000` y `DEBUG=False`.
4. MongoDB 8 guarda datos en `mongo_data`. La aplicación espera el healthcheck de Mongo antes de arrancar.

### Configuración Docker desde `.env`

| Variables | Uso |
|---|---|
| `COMPOSE_PROJECT_NAME` | Nombre del despliegue; mantenerlo estable para reutilizar sus volúmenes. |
| `APP_IMAGE`, `NODE_IMAGE`, `PYTHON_IMAGE`, `MONGO_IMAGE` | Imagen de la app e imágenes base; cambiar bases requiere reconstruir. |
| `APP_BIND_ADDRESS`, `APP_HOST_PORT` | Interfaz y puerto del host que publica la web. |
| `MONGO_BIND_ADDRESS`, `MONGO_HOST_PORT` | Publicación de Mongo; el ejemplo la limita a `127.0.0.1`. |
| `APP_CPUS`, `APP_MEMORY_LIMIT`, `MONGO_CPUS`, `MONGO_MEMORY_LIMIT` | Límites de CPU y memoria. Son valores iniciales, pendientes de prueba de carga. |
| `RESTART_POLICY`, `STOP_GRACE_PERIOD` | Reinicio y plazo de cierre de contenedores; dar más tiempo que `GRACEFUL_TIMEOUT_SECONDS`. |
| `LOG_MAX_SIZE`, `LOG_MAX_FILES` | Rotación de logs de ambos contenedores. |
| `APP_HEALTH_*`, `MONGO_HEALTH_*` | Intervalo, timeout, reintentos y período inicial de cada healthcheck; ver nombres completos en `.env.example`. |

El backend local usa `MONGO_URL`, `MONGO_USER` y `MONGO_PASSWORD`. Compose reemplaza esos valores por `DOCKER_MONGO_URL`, `MONGO_ROOT_USERNAME` y `MONGO_ROOT_PASSWORD`. La URI interna debe ir sin credenciales; el backend las agrega codificando caracteres especiales.

Las variables raíz inicializan Mongo solamente cuando el volumen está vacío. Cambiarlas en `.env` no rota credenciales de una base existente. El despliegue todavía conecta la app con el usuario raíz; un usuario de permisos limitados queda pendiente.

`127.0.0.1` permite acceso desde el propio servidor, apropiado para un proxy instalado allí. Para acceso directo desde la LAN, configurar `APP_BIND_ADDRESS` con la IP del servidor o `0.0.0.0`. Un proxy en otro contenedor necesita conectividad por red Docker. HTTPS y autenticación no se habilitan mediante estas variables: requieren implementación/configuración adicional.

Las copias de audio de Unreal se guardan en el volumen `unreal_audio`; los archivos locales previos no se incluyen en el build ni se migran automáticamente. Mongo mantiene el volumen `mongo_data`.

### Actualizar y detener

Después de cambiar código:

```bash
docker compose up --build -d app
```

Después de cambiar solamente `.env`:

```bash
docker compose up -d --force-recreate app
```

Para detener y eliminar contenedores conservando la base:

```bash
docker compose down
```

`docker compose down -v` también elimina los volúmenes de MongoDB y audios. Usalo únicamente para un borrado deliberado de esos datos.

## 3. Desarrollo local

Requiere Python 3.12+, Node.js 22.12+ de la rama 22 con npm, y MongoDB accesible. Ollama es opcional.

### MongoDB

Podés levantar únicamente la base de Compose:

```bash
docker compose up -d mongo
```

Para conectarte desde el backend local a esa base, completá las mismas credenciales raíz (y ajustá el puerto si cambiaste `MONGO_HOST_PORT`):

```env
MONGO_URL=mongodb://localhost:27017/medsim?authSource=admin
MONGO_DB_NAME=medsim
MONGO_USER=usuario_configurado_en_MONGO_ROOT_USERNAME
MONGO_PASSWORD=clave_configurada_en_MONGO_ROOT_PASSWORD
```

Si usás una instalación local de Mongo sin autenticación, dejá vacías ambas credenciales para que el backend no las agregue:

```env
MONGO_URL=mongodb://localhost:27017/medsim
MONGO_DB_NAME=medsim
MONGO_USER=
MONGO_PASSWORD=
```

### Compilar el frontend

Este paso es necesario antes de arrancar el backend: FastAPI monta `frontend/dist/assets` al importar la aplicación.

```bash
cd frontend
npm ci
npm run build
cd ..
```

### Instalar y arrancar el backend

**Windows (PowerShell):**

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
```

No hace falta activar el entorno virtual ni modificar la política de PowerShell. Si esta bloquea `npm.ps1`, usá `npm.cmd` en los comandos del frontend.

**Linux / macOS:**

```bash
python3.12 -m venv .venv
.venv/bin/python -m pip install --upgrade pip
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python -m uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
```

El backend conecta a Mongo al iniciar. Solo crea o actualiza el paciente, estudiante y encuentro de demostración si `BOOTSTRAP_DEMO=True`. Dejalo en `False` en producción.

Para acceso desde otros equipos de tu red, cambiá `--host 127.0.0.1` por `--host 0.0.0.0`. `--reload` es para desarrollo. Al invocar Uvicorn directamente, sus argumentos mandan sobre las opciones del `.env`. Para usar toda la configuración de ejecución del archivo, arrancá con `.\.venv\Scripts\python.exe -m backend.run` (Windows) o `.venv/bin/python -m backend.run` (Linux/macOS).

### Editar el frontend con recarga automática

Con el backend en el puerto `8000`, abrí otra terminal:

```bash
cd frontend
npm run dev
```

Abrí [el frontend de desarrollo](http://localhost:5173/frontend/index), o el puerto que informe Vite si `5173` está ocupado. Vite redirige `/api` y `/ws` al backend. Para ver cambios desde el puerto `8000`, volvé a ejecutar `npm run build`.

## 4. URLs y verificaciones

| Pantalla o recurso | URL local / Docker |
|---|---|
| Inicio | [Abrir](http://localhost:8000/frontend/index) |
| Unirse a una sesión | [Abrir](http://localhost:8000/frontend/student_join) |
| Sesiones de alumno | [Abrir](http://localhost:8000/frontend/student_sessions) |
| Simulador de alumno | [Abrir](http://localhost:8000/frontend/student) |
| Evaluador | [Abrir](http://localhost:8000/frontend/evaluator) |
| Pacientes | [Abrir](http://localhost:8000/frontend/patients) |
| Estudiantes | [Abrir](http://localhost:8000/frontend/students) |
| Estado de configuración | [Consultar](http://localhost:8000/api/config_state) |
| Encuentros públicos | [Consultar](http://localhost:8000/api/encounters_public) |
| Catálogo SEGUE | [Consultar](http://localhost:8000/api/evaluations/catalog) |
| Documentación de API | [Swagger UI](http://localhost:8000/docs) |

El detalle del evaluador usa `/frontend/evaluator_encounter?encounter_id=<id>`. Entrá al simulador y a los detalles desde los flujos de sesión para recibir sus parámetros.

El healthcheck de la app consulta `/api/config_state`. No hay un endpoint `/health` implementado. Ese chequeo confirma que la API responde, pero no prueba una conversación real ni la disponibilidad de los proveedores de IA.

## 5. Preparación para producción

El Compose actual permite levantar el sistema, pero quedan estos puntos antes de exponerlo a Internet:

- **Base de datos:** definir credenciales propias en `.env`, rotarlas dentro de Mongo si la base ya existe y crear un usuario de aplicación con permisos limitados. La publicación está limitada a loopback por defecto. Definir backups y recuperación del volumen.
- **Acceso:** implementar autenticación y autorización para las operaciones administrativas y evaluación. Los endpoints administrativos de pacientes y estudiantes actuales no tienen protección de acceso.
- **HTTPS:** configurar dominio, certificado y proxy inverso con soporte de WebSocket. El frontend usa el mismo host para API y WebSocket, y selecciona `wss` cuando la página se sirve por HTTPS.
- **Entorno:** completar `.env` desde `.env.example`, conservar `DEBUG=False` y `BOOTSTRAP_DEMO=False` y ajustar red, recursos y proveedores al servidor universitario. Compose lee `.env` explícitamente.
- **Datos demo:** el bootstrap ya está controlado por `BOOTSTRAP_DEMO`; no activarlo en producción.
- **Contenedor y archivos:** definir un usuario sin privilegios para la imagen y una política de retención/backup para el volumen de audios. Las grabaciones locales y los archivos `.env*` se excluyen del build.
- **Publicación:** definir build, validación, actualización y reversión de versiones. No hay CI/CD configurado.

## 6. APK Android e integración Unreal

Este repositorio contiene la web y el backend. No incluye una aplicación Android, proyecto Unreal (`.uproject`), Gradle, claves de firma ni comandos para generar o distribuir APK/AAB. La integración HTTP con Unreal no genera una APK; el cliente y su empaquetado deben incorporarse o mantenerse en otro repositorio.

### Enviar audio desde Unreal

`POST /api/audio/audio_unreal` recibe los bytes de audio en el body. `Content-Type` es opcional y por defecto se interpreta como `audio/wav`.

```bash
curl -X POST "http://127.0.0.1:8000/api/audio/audio_unreal" \
  -H "Content-Type: audio/wav" \
  --data-binary "@sample.wav"
```

En PowerShell, usá `curl.exe` y escribí el comando en una sola línea.

El backend guarda una copia en `backend/unreal_audio_uploads/`, selecciona el primer encuentro activo y ejecuta STT → LLM → TTS. El flujo agrega los mensajes al historial del encuentro.

La respuesta JSON incluye `encounter_id`, `saved_path`, `reply_text` y `assistant_audio`, con `audio_base64` y `content_type`. Un body vacío devuelve `400`; si no hay encuentro activo devuelve `404`. Este endpoint no recibe un identificador de encuentro para elegir la sesión.

## 7. Problemas comunes

| Problema | Qué revisar |
|---|---|
| Falta `frontend/dist/assets` | Ejecutar `npm ci` y `npm run build` en `frontend` antes de arrancar FastAPI. |
| Mongo rechaza la autenticación | Comparar URI y credenciales con la instancia usada. Sin autenticación, vaciar `MONGO_USER` y `MONGO_PASSWORD`. |
| Puerto `27017` ocupado | Verificar si ya existe una instancia de Mongo antes de levantar la de Compose. |
| Puerto `8000` ocupado | Detener la app local o el contenedor que ya lo publica. Si cambiás el puerto del backend local, ajustar también el proxy de Vite. |
| Funciona texto, pero falla audio | Revisar claves STT/TTS, voz, modelos, URLs y logs. `/api/config_state` indica presencia de configuración, no valida las credenciales contra el proveedor. |
| Docker no refleja cambios | Reconstruir para cambios de código y recrear la app después de cambios en `.env`. |
| Falta una dependencia Python | Reinstalar `requirements.txt` con el Python del entorno virtual. |

## Documentación

- [Historias de usuario](docs/HU-00-index.md)
- [Arquitectura](docs/ARCHITECTURE.md)
- [Capacitación](docs/CAPACITACION.md)
- [Flujo de pacientes](docs/pacientesFlujo.md)

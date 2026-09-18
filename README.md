# MedSim — Guía de Despliegue

Simulador de entrevista médico-paciente con paciente IA, audio bidireccional e integración Unreal Engine. Stack: FastAPI + React + MongoDB, desplegado como imagen Docker única detrás de un proxy reverso.

---

## Tabla de contenidos

1. [Arquitectura](#1-arquitectura)
2. [Requisitos del servidor](#2-requisitos-del-servidor)
3. [Configuración inicial](#3-configuración-inicial)
4. [Variables de entorno](#4-variables-de-entorno)
5. [Despliegue con Docker Compose](#5-despliegue-con-docker-compose)
6. [Proxy reverso — Nginx](#6-proxy-reverso--nginx)
7. [Autenticación](#7-autenticación)
8. [Actualizar la aplicación](#8-actualizar-la-aplicación)
9. [Backups](#9-backups)
10. [Monitoreo y logs](#10-monitoreo-y-logs)
11. [Integración Unreal Engine](#11-integración-unreal-engine)
12. [Desarrollo local](#12-desarrollo-local)
13. [Troubleshooting](#13-troubleshooting)

---

## 1. Arquitectura

```
Internet (HTTPS :443)
        │
        ▼
     Nginx                 ← TLS termination + proxy reverso (en el host)
        │
        ├─► HTTP  → app:8000    (FastAPI: API REST + SPA React + WebSocket)
        └─► WS    → app:8000/ws/...
                        │
                        ▼
                   mongo:27017  ← MongoDB (solo accesible dentro de la red Docker)
```

**Un solo contenedor** sirve el frontend compilado (React SPA) y la API. MongoDB corre en un contenedor separado dentro de la red privada `medsim_net`; nunca queda expuesto a internet.

### Componentes externos requeridos

| Servicio | Propósito | Proveedor de ejemplo |
|---|---|---|
| LLM (chat) | Respuestas del paciente IA | Groq, OpenAI, Ollama |
| STT (voz → texto) | Transcripción de audio | Groq Whisper, OpenAI Whisper |
| TTS (texto → voz) | Síntesis de respuesta | Cartesia, ElevenLabs |

---

## 2. Requisitos del servidor

| Requisito | Mínimo recomendado |
|---|---|
| SO | Ubuntu 22.04 LTS / Debian 12 |
| CPU | 2 vCPU |
| RAM | 4 GB |
| Disco | 20 GB SSD |
| Docker | 24.x + Compose v2 (`docker compose`) |
| Nginx | 1.18+ |
| Dominio | Nombre de dominio con DNS apuntando al servidor |
| Certificado TLS | Let's Encrypt (Certbot) o certificado propio |

> [!NOTE]
> Docker y Docker Compose deben estar instalados **antes** de continuar. Verificar con `docker compose version`.

---

## 3. Configuración inicial

### 3.1 Clonar el repositorio

```bash
git clone <url-del-repo> /opt/medsim
cd /opt/medsim
```

### 3.2 Crear el archivo de entorno

```bash
cp .env.example .env
chmod 600 .env   # Solo el owner puede leer el archivo con claves
```

Editar `.env` con un editor de texto. Ver [sección 4](#4-variables-de-entorno) para el detalle de cada variable.

### 3.3 Generar una SECRET_KEY fuerte

```bash
python3 -c "import secrets; print(secrets.token_hex(32))"
```

Copiar el resultado y pegarlo como valor de `SECRET_KEY` en `.env`.

---

## 4. Variables de entorno

Todas las variables se configuran en `.env`. El archivo `.env.example` contiene la plantilla completa con valores por defecto y comentarios.

### Aplicación

| Variable | Descripción | Valor producción |
|---|---|---|
| `PROJECT_NAME` | Título de la API | `MedSim` |
| `HOST` | Interfaz de escucha de Uvicorn | `0.0.0.0` |
| `PORT` | Puerto interno del proceso | `8000` |
| `DEBUG` | Habilita hot-reload y stack traces en respuestas | **`False`** |
| `BOOTSTRAP_DEMO` | Crea datos de demostración al arrancar | **`False`** |
| `LOG_LEVEL` | Nivel de logs de Uvicorn | `info` |
| `PROXY_HEADERS` | Lee `X-Forwarded-For` / `X-Forwarded-Proto` del proxy | **`True`** |
| `FORWARDED_ALLOW_IPS` | IPs de proxy en las que confiar | IP del servidor o `127.0.0.1` |
| `GRACEFUL_TIMEOUT_SECONDS` | Tiempo máximo de cierre ordenado | `30` |

### Autenticación

| Variable | Descripción | Valor producción |
|---|---|---|
| `SITE_PASSWORD` | Contraseña de acceso al sitio. **Vacío = sin login** | Contraseña fuerte |
| `SECRET_KEY` | Clave para firmar cookies de sesión. Cambiar siempre | String aleatorio de 64+ chars |

> [!CAUTION]
> Si `SECRET_KEY` queda con el valor por defecto (`change-me-in-production...`), las sesiones pueden ser forjadas. Generar siempre un valor aleatorio antes de desplegar.

### MongoDB

| Variable | Descripción |
|---|---|
| `MONGO_ROOT_USERNAME` | Usuario root de MongoDB (inicialización del volumen) |
| `MONGO_ROOT_PASSWORD` | Contraseña root. **Obligatoria.** Compose falla si está vacía |
| `DOCKER_MONGO_URL` | URI interna usada por el contenedor app. No incluir credenciales aquí |
| `MONGO_DB_NAME` | Nombre de la base de datos |
| `MONGO_BIND_ADDRESS` | IP del host que expone Mongo. Usar `127.0.0.1` siempre |
| `MONGO_HOST_PORT` | Puerto del host para acceso de administración local |

> [!WARNING]
> Las credenciales root solo inicializan MongoDB cuando el volumen `mongo_data` está **vacío**. Cambiar `MONGO_ROOT_PASSWORD` en `.env` después del primer arranque **no rota** la contraseña dentro de Mongo. Hacerlo manualmente con `mongosh` si es necesario.

### Servicios de IA

| Variable | Descripción |
|---|---|
| `PATIENT_LLM_URL` | URL base del proveedor LLM (compatible con API OpenAI) |
| `PATIENT_LLM_API_KEY` | API key del proveedor LLM |
| `PATIENT_LLM_MODEL` | Nombre del modelo a usar |
| `STT_API_URL` / `STT_API_KEY` / `STT_MODEL` | Proveedor de transcripción de voz (Groq / OpenAI Whisper) |
| `TTS_API_URL` | URL del servicio TTS. Para **TTS-ar en Docker**: `http://tts:8000` (misma red) o `http://host.docker.internal:8001` |
| `TTS_API_KEY` | API key (dejar vacía o `local` para TTS-ar interno) |
| `TTS_VOICE_ID` | Identificador de voz (`0` a `5` para arquetipos clínicos de TTS-ar o nombre/UUID) |
| `TTS_SPEED` / `TTS_TEMPERATURE` | Velocidad de habla (`1.0`) y expresividad/estilo (`0.5`) |

#### Catálogo de Voces Clínicas (TTS-ar / Piper VITS Argentino)
Cuando se utiliza el microservicio `TTS-ar`, MedSim resuelve inteligentemente los arquetipos de pacientes según género y edad o ID directo:
- `0`: **Daniela** — Femenina adulta (tono medio)
- `1`: **Martín** — Masculino adulto (tono medio-grave)
- `2`: **Marta** — Femenina anciana / adulta mayor
- `3`: **Roberto** — Masculino anciano / adulto mayor
- `4`: **Sofía** — Femenina joven (tono ágil)
- `5`: **Lucas** — Masculino joven (tono juvenil)


### Docker Compose

| Variable | Descripción |
|---|---|
| `COMPOSE_PROJECT_NAME` | Nombre del proyecto. **Mantenerlo estable** — determina el nombre de los volúmenes |
| `APP_BIND_ADDRESS` / `APP_HOST_PORT` | Interfaz y puerto del host que publica la app |
| `APP_CPUS` / `APP_MEMORY_LIMIT` | Límites de CPU y memoria del contenedor app |
| `MONGO_CPUS` / `MONGO_MEMORY_LIMIT` | Límites del contenedor MongoDB |
| `LOG_MAX_SIZE` / `LOG_MAX_FILES` | Rotación de logs de Docker |

---

## 5. Despliegue con Docker Compose

### Primera vez

```bash
cd /opt/medsim
docker compose up --build -d
```

Verificar que ambos contenedores están en estado `healthy`:

```bash
docker compose ps
docker compose logs -f app
```

La aplicación queda disponible en `http://127.0.0.1:8000` (loopback del servidor). El acceso externo se habilita a través de Nginx (sección 6).

### Healthcheck

Docker verifica automáticamente `GET /api/config_state`. El contenedor `app` no arranca hasta que `mongo` reporta `healthy`. Ajustar tiempos con `APP_HEALTH_*` y `MONGO_HEALTH_*` en `.env` si el servidor es más lento.

---

## 6. Proxy reverso — Nginx

### 6.1 Instalar Nginx y Certbot

```bash
apt install -y nginx certbot python3-certbot-nginx
```

### 6.2 Obtener certificado TLS

```bash
certbot certonly --nginx -d tu-dominio.com
```

### 6.3 Configuración de Nginx

Crear `/etc/nginx/sites-available/medsim`:

```nginx
server {
    listen 80;
    server_name tu-dominio.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name tu-dominio.com;

    ssl_certificate     /etc/letsencrypt/live/tu-dominio.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/tu-dominio.com/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;

    client_max_body_size 20M;  # Para uploads de audio

    # Headers de seguridad
    add_header X-Frame-Options SAMEORIGIN;
    add_header X-Content-Type-Options nosniff;
    add_header Referrer-Policy strict-origin-when-cross-origin;

    location / {
        proxy_pass         http://127.0.0.1:8000;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
    }

    # WebSocket — necesario para el chat en tiempo real
    location /ws/ {
        proxy_pass         http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection "upgrade";
        proxy_set_header   Host $host;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }
}
```

```bash
ln -s /etc/nginx/sites-available/medsim /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

### 6.4 Renovación automática de certificados

Certbot instala un cron/systemd timer automáticamente. Verificar:

```bash
certbot renew --dry-run
```

### 6.5 Actualizar variables de entorno post-Nginx

Con HTTPS y Nginx funcionando, actualizar en `.env`:

```env
PROXY_HEADERS=True
FORWARDED_ALLOW_IPS=127.0.0.1
```

Y en `backend/api/auth.py`, cambiar `secure=False` a `secure=True` en `set_cookie` para que la cookie de sesión solo viaje por HTTPS.

---

## 7. Autenticación

La aplicación incluye un sistema de login básico basado en **cookie de sesión firmada con HMAC-SHA256**.

### Cómo funciona

- Si `SITE_PASSWORD` está vacío → sin login (modo desarrollo).
- Si `SITE_PASSWORD` tiene valor → toda la app queda protegida.
- Al ingresar la contraseña correcta en `/auth/login`, se genera una cookie firmada con `SECRET_KEY` que caduca a los **30 días**.
- Las cookies son `HttpOnly` (no accesibles desde JavaScript).
- El endpoint `/api/audio/audio_unreal` está excluido del login (es llamado por Unreal Engine desde la red interna).
- El healthcheck `/api/config_state` también está excluido (usado por Docker).

### Configurar en producción

```env
SITE_PASSWORD=una-contrasena-larga-y-dificil-de-adivinar
SECRET_KEY=resultado-del-comando-secrets-token-hex-32
```

Después de cambiar `SITE_PASSWORD` o `SECRET_KEY`, todas las sesiones existentes quedan invalidadas automáticamente.

> [!IMPORTANT]
> Una vez que se desplegue con HTTPS, cambiar `secure=False` a `secure=True` en `backend/api/auth.py` en la llamada a `set_cookie`, y hacer rebuild. Esto garantiza que la cookie de sesión nunca viaje por HTTP en claro.

---

## 8. Actualizar la aplicación

### Actualizar código

```bash
cd /opt/medsim
git pull
docker compose up --build -d app
```

### Actualizar solo configuración (`.env`)

```bash
docker compose up -d --force-recreate app
```

### Rollback

```bash
git checkout <commit-anterior>
docker compose up --build -d app
```

### Detener todo conservando datos

```bash
docker compose down
```

> [!CAUTION]
> `docker compose down -v` elimina los volúmenes de MongoDB y audios de Unreal. Usarlo solo para un borrado intencional y completo de datos.

---

## 9. Backups

### MongoDB

```bash
# Backup
docker exec medsim-mongo-1 mongodump \
  --username admin \
  --password <MONGO_ROOT_PASSWORD> \
  --authenticationDatabase admin \
  --db medsim \
  --out /tmp/backup-$(date +%Y%m%d)

docker cp medsim-mongo-1:/tmp/backup-$(date +%Y%m%d) ./backups/

# Restaurar
docker cp ./backups/backup-20260915 medsim-mongo-1:/tmp/restore
docker exec medsim-mongo-1 mongorestore \
  --username admin \
  --password <MONGO_ROOT_PASSWORD> \
  --authenticationDatabase admin \
  --db medsim /tmp/restore/medsim
```

### Audios de Unreal

El volumen `medsim_unreal_audio` contiene las grabaciones. Hacer backup del volumen Docker o configurar un bind mount a una ruta del host con backup externo.

---

## 10. Monitoreo y logs

```bash
# Estado de los contenedores
docker compose ps

# Logs en tiempo real
docker compose logs -f app
docker compose logs -f mongo

# Últimas 100 líneas
docker compose logs --tail=100 app

# Uso de recursos
docker stats medsim-app-1 medsim-mongo-1
```

El endpoint `/api/config_state` devuelve el estado de configuración de servicios externos (LLM, STT, TTS) sin exponer las claves. Útil para verificar que el backend arrancó correctamente:

```bash
curl http://127.0.0.1:8000/api/config_state
```

---

## 11. Integración Unreal Engine

El endpoint `POST /api/audio/audio_unreal` recibe audio crudo en el body y ejecuta el flujo completo: **STT → LLM → TTS**.

```bash
# Prueba desde el servidor
curl -X POST "http://127.0.0.1:8000/api/audio/audio_unreal" \
  -H "Content-Type: audio/wav" \
  --data-binary "@sample.wav"
```

**Respuesta JSON:**

```json
{
  "encounter_id": "...",
  "saved_path": "backend/unreal_audio_uploads/audio-unreal-xxx.wav",
  "reply_text": "Texto de la respuesta del paciente",
  "assistant_audio": {
    "audio_base64": "<base64 del WAV de respuesta>",
    "content_type": "audio/wav"
  }
}
```

- `400` si el body está vacío.
- `404` si no hay ningún encuentro activo en el sistema.
- Este endpoint **no requiere login** (está en la whitelist del middleware).
- Los archivos recibidos se persisten en el volumen `unreal_audio`.

---

## 12. Desarrollo local

Requiere Python 3.12+, Node.js 22+ y MongoDB accesible.

### Levantar solo MongoDB con Docker

```bash
docker compose up -d mongo
```

### Configurar `.env` local

```env
MONGO_URL=mongodb://localhost:27017/medsim?authSource=admin
MONGO_USER=admin
MONGO_PASSWORD=<valor de MONGO_ROOT_PASSWORD>
SITE_PASSWORD=          # Vacío para desarrollo sin login
DEBUG=True
```

### Backend

```bash
python3.12 -m venv .venv
source .venv/bin/activate       # Linux/macOS
# .venv\Scripts\Activate.ps1   # Windows PowerShell

pip install -r requirements.txt
python -m backend.run
```

### Frontend (con hot-reload)

```bash
cd frontend
npm ci
npm run dev
```

Acceder en `http://localhost:5173/frontend/index`. Vite redirige `/api` y `/ws` al backend en `8000`.

---

## 13. Troubleshooting

| Síntoma | Causa probable | Solución |
|---|---|---|
| `bind: address already in use` en puerto `27017` | MongoDB local corriendo en el host | Cambiar `MONGO_HOST_PORT=27018` en `.env` |
| `bind: address already in use` en puerto `8000` | Otro proceso usa el puerto | Cambiar `APP_HOST_PORT` o detener el proceso |
| `No such container` al hacer `up` | Contenedor stale de intento anterior | `docker compose down --remove-orphans` y volver a intentar |
| Frontend muestra pantalla en blanco | `frontend/dist` no existe | Ejecutar `npm ci && npm run build` en `frontend/` |
| Mongo rechaza autenticación | Credenciales incorrectas o volumen con usuario diferente | Verificar `MONGO_ROOT_USERNAME/PASSWORD`. Si el volumen ya existe con otras credenciales, hacer `docker compose down -v` (borra datos) y recrear |
| Audio no funciona, texto sí | API keys de STT/TTS incorrectas o sin saldo | Revisar `STT_API_KEY`, `TTS_API_KEY`. Consultar `/api/config_state` |
| WebSocket se desconecta al instante | Nginx sin configuración de upgrade | Agregar bloque `location /ws/` con headers `Upgrade` y `Connection` |
| Cookie de sesión no persiste en HTTPS | `secure=False` en `auth.py` | Cambiar a `secure=True` y hacer rebuild |
| Cambié `.env` pero la app no actualiza | Docker cachea el entorno | `docker compose up -d --force-recreate app` |
| `SECRET_KEY` con valor por defecto | Se olvidó generar uno | Generar con `python3 -c "import secrets; print(secrets.token_hex(32))"` |

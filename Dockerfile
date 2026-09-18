# ──────────────────────────────────────────────
# Stage 1: build del frontend React
# ──────────────────────────────────────────────
ARG NODE_IMAGE=node:22-slim
ARG PYTHON_IMAGE=python:3.12-slim
FROM ${NODE_IMAGE} AS frontend-builder

WORKDIR /app/frontend

# Copiar manifests primero para aprovechar cache de Docker
COPY frontend/package.json frontend/package-lock.json ./

RUN npm ci

# Copiar el resto del código fuente y buildear
COPY frontend/ ./

RUN npm run build


# ──────────────────────────────────────────────
# Stage 2: imagen final con Python + FastAPI
# ──────────────────────────────────────────────
FROM ${PYTHON_IMAGE} AS backend

WORKDIR /app

# Dependencias Python
COPY requirements.txt ./
RUN pip install --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Código fuente del backend
COPY backend ./backend/

# Archivos estáticos del frontend compilados en el stage anterior
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist/

# Puerto predeterminado; Compose usa PORT para el mapeo real.
EXPOSE 8000

CMD ["python", "-m", "backend.run"]

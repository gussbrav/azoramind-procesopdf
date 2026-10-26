# ============================================================
# Imagen unificada: React (build) + FastAPI (serve)
# Un solo contenedor sirve el frontend estático y la API.
# ============================================================

# Stage 1 — Compilar React
FROM node:20-slim AS frontend-builder

WORKDIR /frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ .

# API en la misma URL base — no necesita prefijo externo
ARG VITE_API_URL=/
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build


# Stage 2 — Backend Python con frontend incluido
FROM python:3.13-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    libpq-dev \
    gcc \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar código del backend
COPY backend/ .

# Copiar frontend compilado al directorio que FastAPI servirá
COPY --from=frontend-builder /frontend/dist /app/static_frontend

EXPOSE 8001

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD curl -f http://localhost:8001/api/health || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001", "--workers", "2"]

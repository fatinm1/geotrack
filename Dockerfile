# GeoTrack: Frontend + Backend in one image for Railway
# Service 1: this app (listens on PORT). Service 2: PostgreSQL (Railway Postgres plugin).

# ---- Frontend build ----
FROM node:20-alpine AS frontend
WORKDIR /app
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

# ---- Runtime: Python slim + Node + Caddy ----
FROM python:3.11-slim
WORKDIR /app

# Install Node 20, Caddy, and backend build deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl ca-certificates build-essential libpq-dev \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && curl -L -o /tmp/caddy.tar.gz "https://github.com/caddyserver/caddy/releases/download/v2.7.6/caddy_2.7.6_linux_amd64.tar.gz" \
    && tar -xzf /tmp/caddy.tar.gz -C /usr/bin caddy && rm /tmp/caddy.tar.gz \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Backend
COPY backend/requirements.txt backend/
RUN pip install --no-cache-dir -r backend/requirements.txt
COPY backend/ backend/

# Frontend standalone
COPY --from=frontend /app/.next/standalone ./frontend
COPY --from=frontend /app/.next/static ./frontend/.next/static
COPY --from=frontend /app/public ./frontend/public

# Caddy and start script
COPY Caddyfile .
COPY scripts/start.sh /start.sh
RUN chmod +x /start.sh

ENV PYTHONPATH=/app/backend
ENV PORT=3000

EXPOSE 3000

CMD ["/start.sh"]

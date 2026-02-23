#!/bin/sh
set -e

# Run migrations (backend uses DATABASE_URL)
cd /app/backend && alembic upgrade head || true
cd /app

# Start backend in background (FastAPI)
uvicorn app.main:app --host 0.0.0.0 --port 8000 &

# Next.js on 3000 (Caddy listens on $PORT and proxies to 3000 and 8000)
cd /app/frontend && HOSTNAME=0.0.0.0 PORT=3000 node server.js &

# Wait for servers to bind
sleep 3

# Caddy in foreground (listens on Railway's PORT, proxies to 8000 and 3000)
exec caddy run --config /app/Caddyfile --adapter caddyfile

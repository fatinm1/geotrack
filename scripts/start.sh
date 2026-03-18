#!/bin/sh
set -e

# Run migrations with retries (Railway Postgres may take a moment to be reachable)
cd /app/backend
n=0
while [ $n -lt 5 ]; do
  if alembic upgrade head; then
    break
  fi
  n=$((n + 1))
  if [ $n -eq 5 ]; then
    echo "Migrations failed after 5 attempts. On Railway, set DATABASE_URL to your Postgres service URL (Variables → Add variable or link Postgres)."
    exit 1
  fi
  echo "Migration attempt $n failed, retrying in 5s..."
  sleep 5
done
cd /app

# Start backend in background (FastAPI)
RUN_MIGRATIONS_IN_APP=false uvicorn app.main:app --host 0.0.0.0 --port 8000 &

# Next.js on 3000 (Caddy listens on $PORT and proxies to 3000 and 8000)
cd /app/frontend && HOSTNAME=0.0.0.0 PORT=3000 node server.js &

# Wait for servers to bind
sleep 3

# Caddy in foreground (listens on Railway's PORT, proxies to 8000 and 3000)
exec caddy run --config /app/Caddyfile --adapter caddyfile

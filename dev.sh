#!/usr/bin/env bash
#
# dev.sh — start the full Auctiva local stack.
#
#   1. Docker infra  : MongoDB (+ Mongo Express), Redis, Centrifugo
#   2. Backend API   : http://localhost:4000   (backend/  npm run dev)
#   3. Backend worker: chain watcher + deploy queue (backend/  npm run worker)
#   4. Frontend      : http://localhost:5173   (frontend/ npm run dev)
#   5. ngrok tunnel  : public URL → backend :4000 (for Clerk webhooks)
#
# Skip the tunnel with NO_NGROK=1 ./dev.sh
#
# Ctrl+C stops the Node processes. Docker infra is left running; pass --down
# (or run `docker compose down`) to stop it too.
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

# --- options ---------------------------------------------------------------
if [[ "${1:-}" == "--down" ]]; then
  echo "==> Stopping Docker infra"
  docker compose down
  exit 0
fi

# --- prerequisites ---------------------------------------------------------
for f in .env backend/.env frontend/.env; do
  if [[ ! -f "$f" ]]; then
    echo "!! Missing $f — copy from ${f%.*}.env.example and fill it in." >&2
    exit 1
  fi
done

if [[ ! -d backend/node_modules ]]; then
  echo "==> Installing backend deps"; (cd backend && npm install)
fi
if [[ ! -d frontend/node_modules ]]; then
  echo "==> Installing frontend deps"; (cd frontend && npm install)
fi

# --- infra -----------------------------------------------------------------
echo "==> Starting Docker infra (Mongo, Redis, Centrifugo)"
docker compose up -d --wait

# --- app processes ---------------------------------------------------------
pids=()
cleanup() {
  echo ""
  echo "==> Shutting down app processes"
  for pid in "${pids[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
  wait 2>/dev/null || true
  echo "==> Done. Docker infra still running (./dev.sh --down to stop it)."
}
trap cleanup INT TERM EXIT

echo "==> Starting backend API"
(cd backend && npm run dev) &
pids+=($!)

echo "==> Starting backend worker"
(cd backend && npm run worker) &
pids+=($!)

echo "==> Starting frontend"
(cd frontend && npm run dev) &
pids+=($!)

# --- ngrok tunnel ----------------------------------------------------------
ngrok_url=""
if [[ "${NO_NGROK:-}" != "1" ]]; then
  if command -v ngrok >/dev/null 2>&1; then
    echo "==> Starting ngrok tunnel → http://localhost:4000"
    ngrok http 4000 --log=stdout >/tmp/auctiva-ngrok.log 2>&1 &
    pids+=($!)
    # ngrok exposes a local API on :4040 — poll it for the public URL.
    for _ in $(seq 1 20); do
      ngrok_url=$(curl -s http://localhost:4040/api/tunnels 2>/dev/null \
        | grep -o '"public_url":"https://[^"]*"' | head -n1 | cut -d'"' -f4 || true)
      [[ -n "$ngrok_url" ]] && break
      sleep 0.5
    done
    if [[ -z "$ngrok_url" ]]; then
      echo "!! ngrok started but no URL yet — check /tmp/auctiva-ngrok.log"
      echo "   (free ngrok needs an authtoken: ngrok config add-authtoken <token>)"
    fi
  else
    echo "!! ngrok not found — skipping tunnel (install it or set NO_NGROK=1)"
  fi
fi

echo ""
echo "==> All services starting:"
echo "      API        http://localhost:4000"
echo "      Frontend   http://localhost:5173"
echo "      Mongo UI   http://localhost:8081"
echo "      Centrifugo http://localhost:8000"
[[ -n "$ngrok_url" ]] && echo "      ngrok      $ngrok_url  →  :4000"
[[ -n "$ngrok_url" ]] && echo "                 Clerk webhook: $ngrok_url/api/webhooks/clerk"
echo "    Press Ctrl+C to stop."

wait

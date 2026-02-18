#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="$ROOT_DIR/.logs"
PID_FILE="$ROOT_DIR/.sentinelpharma.pids"

mkdir -p "$LOG_DIR"

echo "========================================"
echo "Starting SentinelPharma (Linux)"
echo "========================================"

kill_port() {
  local port="$1"
  if command -v lsof >/dev/null 2>&1; then
    local pids
    pids="$(lsof -t -iTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)"
    if [[ -n "$pids" ]]; then
      echo "Killing process on port $port: $pids"
      kill -9 $pids || true
    fi
  fi
}

echo "Cleaning up existing listeners (3001, 5173, 5174, 8000)..."
kill_port 3001
kill_port 5173
kill_port 5174
kill_port 8000

rm -f "$PID_FILE"

echo "[1/3] Starting AI Engine..."
(
  cd "$ROOT_DIR/ai_engine"
  exec "$ROOT_DIR/ai_engine/.venv/bin/python" -m uvicorn app.main:app --app-dir "$ROOT_DIR/ai_engine" --host 0.0.0.0 --port 8000
) >"$LOG_DIR/ai_engine.log" 2>&1 &
echo $! >> "$PID_FILE"

sleep 2

echo "[2/3] Starting Server..."
(
  cd "$ROOT_DIR/server"
  exec npm start
) >"$LOG_DIR/server.log" 2>&1 &
echo $! >> "$PID_FILE"

sleep 2

echo "[3/3] Starting Client..."
(
  cd "$ROOT_DIR/client"
  exec node "$ROOT_DIR/client/node_modules/vite/bin/vite.js" "$ROOT_DIR/client" --host 0.0.0.0 --port 5173
) >"$LOG_DIR/client.log" 2>&1 &
echo $! >> "$PID_FILE"

sleep 3

echo
echo "========================================"
echo "Startup complete"
echo "========================================"
echo "Frontend:  http://localhost:5173"
echo "Backend:   http://localhost:3001"
echo "AI Engine: http://localhost:8000"
echo
echo "Logs:"
echo "  $LOG_DIR/ai_engine.log"
echo "  $LOG_DIR/server.log"
echo "  $LOG_DIR/client.log"
echo
echo "To stop all services:"
echo "  xargs -r kill < \"$PID_FILE\" && rm -f \"$PID_FILE\""

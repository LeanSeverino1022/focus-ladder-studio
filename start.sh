#!/bin/sh
# Serves this folder at a fixed address so your saved data is always found.
# Open exactly:  http://127.0.0.1:4747
cd "$(dirname "$0")" || exit 1
PORT=4747
if command -v lsof >/dev/null 2>&1 && lsof -iTCP:$PORT -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Port $PORT is already in use. If that is this app, just open http://127.0.0.1:$PORT"
  echo "Otherwise stop the other program first (a different port would hide your saved data)."
  exit 1
fi
echo "Quiet Studio: http://127.0.0.1:$PORT   (Ctrl+C to stop)"
exec python3 -m http.server $PORT --bind 127.0.0.1

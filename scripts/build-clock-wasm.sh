#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
SDK_ENV="${EMSDK:-$HOME/emsdk}/emsdk_env.sh"

if ! command -v em++ >/dev/null 2>&1; then
  if [[ ! -f "$SDK_ENV" ]]; then
    echo "Emscripten C++ compiler not found. Set EMSDK or install emsdk under ~/emsdk." >&2
    exit 1
  fi
  source "$SDK_ENV" >/dev/null
fi

OUTPUT="$ROOT_DIR/apps/examples/clock/app.wasm"
em++ "$ROOT_DIR/apps/examples/clock/clock.cpp" \
  -std=c++98 -O2 -fno-exceptions -fno-rtti -sSTANDALONE_WASM=1 \
  -sINITIAL_MEMORY=2097152 \
  -Wl,--no-entry \
  -Wl,--export=maia_app_start \
  -Wl,--export=maiaos_step \
  -Wl,--export-memory \
  -o "$OUTPUT"

echo "Maia Clock guest: $OUTPUT"
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

OUTPUT="$ROOT_DIR/apps/examples/calculator/app.wasm"
em++ "$ROOT_DIR/apps/examples/calculator/calculator.cpp" \
  -std=c++98 -O2 -fno-exceptions -fno-rtti -sSTANDALONE_WASM=1 \
  -sINITIAL_MEMORY=2097152 \
  -sSTACK_SIZE=65536 -sINITIAL_HEAP=65536 \
  -Wl,--no-entry \
  -Wl,--export=maia_app_start \
  -Wl,--export=maiaos_step \
  -Wl,--export-memory \
  -o "$OUTPUT"

echo "Maia Calculator guest: $OUTPUT"
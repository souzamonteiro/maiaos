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

OUTPUT_DIR="$ROOT_DIR/platform/desktop-web/generated"
mkdir -p "$OUTPUT_DIR"

em++ "$ROOT_DIR/apps/kernel/kernel.cpp" \
  -std=c++98 -O2 -fno-exceptions -fno-rtti -sSTANDALONE_WASM=1 \
  -sINITIAL_MEMORY=2097152 \
  -Wl,--no-entry \
  -Wl,--export=maiaos_start \
  -Wl,--export=maiaos_step \
  -Wl,--export-memory \
  -o "$OUTPUT_DIR/kernel.wasm"

echo "C++98 MaiaOS kernel guest: $OUTPUT_DIR/kernel.wasm"

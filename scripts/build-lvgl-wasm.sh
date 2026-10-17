#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
SDK_ENV="${EMSDK:-$HOME/emsdk}/emsdk_env.sh"

if ! command -v emcmake >/dev/null 2>&1; then
  if [[ ! -f "$SDK_ENV" ]]; then
    echo "Emscripten not found. Set EMSDK or install emsdk under ~/emsdk." >&2
    exit 1
  fi
  source "$SDK_ENV" >/dev/null
fi

BUILD_DIR="${MAIAOS_LVGL_BUILD_DIR:-$ROOT_DIR/build/lvgl-browser-emscripten}"
OUTPUT_DIR="$ROOT_DIR/platform/desktop-web/generated"
mkdir -p "$OUTPUT_DIR"

emcmake cmake -S "$ROOT_DIR/platform/desktop-web/lvgl" -B "$BUILD_DIR" \
  -DCMAKE_BUILD_TYPE=Release \
  -DCMAKE_RUNTIME_OUTPUT_DIRECTORY="$OUTPUT_DIR" \
  -DMAIAOS_LVGL_SOURCE_DIR="${MAIAOS_LVGL_SOURCE_DIR:-}"
cmake --build "$BUILD_DIR" --config Release --parallel

bash "$ROOT_DIR/scripts/build-kernel-wasm.sh"
bash "$ROOT_DIR/scripts/build-calculator-wasm.sh"
bash "$ROOT_DIR/scripts/build-clock-wasm.sh"
node "$ROOT_DIR/scripts/test-lvgl-host.mjs"

echo "LVGL browser module: $OUTPUT_DIR/maiaos-lvgl.js"
echo "C++98 MaiaOS kernel: $OUTPUT_DIR/kernel.wasm"
echo "Maia Calculator guest: $ROOT_DIR/apps/examples/calculator/app.wasm"
echo "Maia Clock guest: $ROOT_DIR/apps/examples/clock/app.wasm"

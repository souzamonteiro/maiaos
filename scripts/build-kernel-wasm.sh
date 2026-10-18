#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
MAIACPP="$ROOT_DIR/maiacpp/bin/webcpp.sh"

if [[ ! -x "$MAIACPP" ]]; then
  echo "MaiaCpp submodule is missing. Run git submodule update --init --recursive." >&2
  exit 1
fi

OUTPUT_DIR="$ROOT_DIR/platform/desktop-web/generated"
mkdir -p "$OUTPUT_DIR"
"$MAIACPP" --file "$ROOT_DIR/apps/kernel/kernel.cpp" --ast-strict \
  --wasm-out "$OUTPUT_DIR/kernel.wasm"

echo "C++98 MaiaOS kernel guest: $OUTPUT_DIR/kernel.wasm"

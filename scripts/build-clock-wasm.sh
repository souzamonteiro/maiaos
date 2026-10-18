#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
MAIACPP="$ROOT_DIR/maiacpp/bin/webcpp.sh"

if [[ ! -x "$MAIACPP" ]]; then
  echo "MaiaCpp submodule is missing. Run git submodule update --init --recursive." >&2
  exit 1
fi

OUTPUT="$ROOT_DIR/apps/examples/clock/app.wasm"
"$MAIACPP" --file "$ROOT_DIR/apps/examples/clock/clock.cpp" \
  --ast-strict --wasm-out "$OUTPUT"

echo "Maia Clock guest: $OUTPUT"
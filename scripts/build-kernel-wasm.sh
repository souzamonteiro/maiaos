#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
MAIACPP="$ROOT_DIR/maiacpp/bin/webcpp.sh"

if [[ ! -x "$MAIACPP" ]]; then
  echo "MaiaCpp submodule is missing. Run git submodule update --init --recursive." >&2
  exit 1
fi

KERNEL_BUILD_TEMP="$(mktemp -d "${TMPDIR:-/tmp}/maia-kernel-build.XXXXXX")"
trap 'rm -f "$KERNEL_BUILD_TEMP/kernel.c"; rmdir "$KERNEL_BUILD_TEMP"' EXIT
OUTPUT_DIR="$ROOT_DIR/platform/desktop-web/generated"
mkdir -p "$OUTPUT_DIR"
"$MAIACPP" --file "$ROOT_DIR/apps/kernel/kernel.cpp" --ast-strict \
  --c-out "$KERNEL_BUILD_TEMP/kernel.c" --wasm-out "$OUTPUT_DIR/kernel.wasm"

if [[ "${1:-}" == "--check-c89" ]]; then
  "${CC:-clang}" --target=wasm32-unknown-unknown -std=c89 -pedantic-errors -ffreestanding \
    -Werror=implicit-function-declaration -fsyntax-only "$KERNEL_BUILD_TEMP/kernel.c"
fi

echo "C++98 MaiaOS kernel guest: $OUTPUT_DIR/kernel.wasm"

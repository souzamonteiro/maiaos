#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
MAIACPP="$ROOT_DIR/maiacpp/bin/webcpp.sh"
MAIACC="$ROOT_DIR/maiacpp/maiacc/bin/tREx.sh"
SHELL_DIR="$ROOT_DIR/apps/shell"
GENERATED_DIR="$SHELL_DIR/generated"
PARSER_HEADER="$GENERATED_DIR/maia-shell-parser.hpp"
TEMP_DIR="$(mktemp -d)"
GENERATED_HEADER=0

cleanup() {
  if [[ "$GENERATED_HEADER" == 1 ]]; then
    rm -f "$PARSER_HEADER"
    rmdir "$GENERATED_DIR" 2>/dev/null || true
  fi
  rm -rf "$TEMP_DIR"
}
trap cleanup EXIT

if [[ ! -x "$MAIACPP" || ! -x "$MAIACC" ]]; then
  echo "MaiaCpp/MaiaCC submodules are missing. Run git submodule update --init --recursive." >&2
  exit 1
fi

if [[ -e "$PARSER_HEADER" ]]; then
  echo "Refusing to overwrite existing generated parser: $PARSER_HEADER" >&2
  exit 1
fi

mkdir -p "$GENERATED_DIR"
GENERATED_HEADER=1
"$MAIACC" --ebnf --to-xml "$TEMP_DIR/maia-shell.xml" --language cpp98 \
  "$SHELL_DIR/maia-shell.ebnf" "$PARSER_HEADER"
"$MAIACPP" --file "$SHELL_DIR/shell.cpp" --ast-strict \
  --wasm-out "$SHELL_DIR/shell.wasm"

echo "MaiaOS Shell guest: $SHELL_DIR/shell.wasm"
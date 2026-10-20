#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"

export MAIACC_ROOT="${MAIACC_ROOT:-$ROOT_DIR/maiacpp/maiacc}"
if [[ ! -f "$MAIACC_ROOT/parser-generator/REx.js" ]]; then
  echo "The repository-local MaiaCC submodule is missing; initialize submodules recursively." >&2
  exit 2
fi

node "$ROOT_DIR/apps/shell/tests/test-shell-grammar.js" "$@"

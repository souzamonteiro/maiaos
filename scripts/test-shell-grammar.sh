#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"

if [[ -z "${MAIACC_ROOT:-}" ]]; then
  echo "Set MAIACC_ROOT to the MaiaCC checkout (the directory containing parser-generator/)." >&2
  exit 2
fi

node "$ROOT_DIR/apps/shell/tests/test-shell-grammar.js" "$@"
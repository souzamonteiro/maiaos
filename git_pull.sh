#!/usr/bin/env bash
set -euo pipefail

git pull --recurse-submodules
git submodule sync --recursive
git submodule update --init --remote --recursive

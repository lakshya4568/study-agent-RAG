#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

"$REPO_ROOT/.venv/bin/python" "$REPO_ROOT/python/tests/smoke_retriever_readme.py"

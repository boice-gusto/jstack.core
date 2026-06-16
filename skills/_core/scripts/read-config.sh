#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
if [[ -f "$ROOT/jstack.config.json" ]]; then
  cat "$ROOT/jstack.config.json"
else
  echo "{}" >&2
  exit 1
fi

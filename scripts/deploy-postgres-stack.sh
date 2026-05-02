#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/local.env}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Env file not found: $ENV_FILE" >&2
  exit 1
fi

cd "$ROOT_DIR"

podman compose --env-file "$ENV_FILE" build
podman compose down
podman compose --env-file "$ENV_FILE" up -d

bash "$ROOT_DIR/scripts/run-postgres-migration.sh"
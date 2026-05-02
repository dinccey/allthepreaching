#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/local.env}"
DEFAULT_IMPORT_ARGS=(--truncate --import-docs)

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Env file not found: $ENV_FILE" >&2
  exit 1
fi

compose() {
  podman compose --env-file "$ENV_FILE" "$@"
}

wait_for_postgres() {
  local retries=30
  local attempt=1

  while (( attempt <= retries )); do
    if compose exec -T postgres sh -lc 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"' >/dev/null 2>&1; then
      return 0
    fi

    echo "Waiting for postgres to become ready ($attempt/$retries)..."
    attempt=$((attempt + 1))
    sleep 2
  done

  echo "Postgres did not become ready in time" >&2
  return 1
}

main() {
  local import_args=("$@")

  if [[ ${#import_args[@]} -eq 0 ]]; then
    import_args=("${DEFAULT_IMPORT_ARGS[@]}")
  fi

  echo "Starting postgres service"
  compose up -d postgres
  wait_for_postgres

  echo "Running MariaDB to Postgres import: ${import_args[*]}"
  compose run --rm backend node scripts/migrateMariaDbToPostgres.js "${import_args[@]}"

  echo "Running one-shot fts catch-up pass"
  compose run --rm \
    -e INDEXER_RUN_ON_STARTUP=true \
    -e INDEXER_STARTUP_MODE=incremental \
    -e INDEXER_EXIT_AFTER_STARTUP_RUN=true \
    fts

  echo "Migration and initial indexing completed"
}

main "$@"
# Postgres Migration Runbook

This runbook documents the working local steps for the MariaDB to Postgres migration so the process is easy to repeat.

## Scope of this first implementation slice

This slice does three things:

1. provisions a compatibility-first Postgres schema for `videos` and `docs_upload`
2. imports `videos` from the live MariaDB source into local Postgres
3. keeps the original MariaDB `date` string while also deriving `published_at` when a valid date can be parsed
4. adds Postgres-backed subtitle indexing tables with file-hash tracking and deleted-file cleanup
5. serves both metadata search and subtitle search from `be` when `DB_CLIENT=postgres`

This is now sufficient for local Postgres-backed backend validation, including subtitle search.

## Local Postgres target

The current local target is the Postgres 18 container started with:

```bash
podman run -d \
  --name allthepreaching-postgres \
  -e POSTGRES_DB=allthepreaching \
  -e POSTGRES_USER=atp_postgres \
  -e POSTGRES_PASSWORD=atp_postgres_dev \
  -e PGDATA=/var/lib/postgresql/data/pgdata \
  -p 127.0.0.1:5432:5432 \
  -v allthepreaching-postgres-data:/var/lib/postgresql/data \
  docker.io/postgres:18
```

The matching compose service already exists in [docker-compose.yml](/var/home/vaslim/Projects/allthepreaching/docker-compose.yml).

## Source and target environment variables

The importer uses these defaults:

### MariaDB source

- `SOURCE_DB_HOST` or `DB_HOST`
- `SOURCE_DB_PORT` or `DB_PORT`
- `SOURCE_DB_USER` or `DB_USER`
- `SOURCE_DB_PASS` or `DB_PASS`
- `SOURCE_DB_NAME` or `DB_NAME`

### Postgres target

- `TARGET_PGHOST` or `PGHOST`, default `127.0.0.1`
- `TARGET_PGPORT` or `PGPORT`, default `5432`
- `TARGET_PGUSER` or `PGUSER`, default `atp_postgres`
- `TARGET_PGPASSWORD` or `PGPASSWORD`, default `atp_postgres_dev`
- `TARGET_PGDATABASE` or `PGDATABASE`, default `allthepreaching`

## Compose deployment migration path

The repo now includes a committed wrapper for the production cutover flow:

- [scripts/run-postgres-migration.sh](/var/home/vaslim/Projects/allthepreaching/scripts/run-postgres-migration.sh)

Default behavior:

1. starts the `postgres` compose service
2. waits for Postgres readiness
3. runs `node scripts/migrateMariaDbToPostgres.js --truncate --import-docs` inside a one-off `backend` compose container
4. runs a one-off `fts` incremental catch-up pass so the new Postgres-backed search data starts filling immediately after import

Default command:

```bash
cd /var/home/vaslim/Projects/allthepreaching
bash ./scripts/run-postgres-migration.sh
```

Equivalent package command:

```bash
cd /var/home/vaslim/Projects/allthepreaching
yarn db:postgres:migrate:compose
```

The wrapper reads `local.env` by default and expects these one-time source variables to be present there for the MariaDB import:

- `SOURCE_DB_HOST`
- `SOURCE_DB_PORT`
- `SOURCE_DB_USER`
- `SOURCE_DB_PASS`
- `SOURCE_DB_NAME`

You can override the env file path with `ENV_FILE=/path/to/file`.

## Files added for this slice

- [be/sql/postgres/001_init.sql](/var/home/vaslim/Projects/allthepreaching/be/sql/postgres/001_init.sql)
- [be/scripts/migrateMariaDbToPostgres.js](/var/home/vaslim/Projects/allthepreaching/be/scripts/migrateMariaDbToPostgres.js)
- [be/scripts/indexSubtitlesToPostgres.js](/var/home/vaslim/Projects/allthepreaching/be/scripts/indexSubtitlesToPostgres.js)

## Commands

### Initialize the Postgres schema only

```bash
cd /var/home/vaslim/Projects/allthepreaching/be
npm run db:postgres:init
```

### Import `videos` only

```bash
cd /var/home/vaslim/Projects/allthepreaching/be
npm run db:postgres:import
```

### Import `videos` and legacy `docsUpload`

```bash
cd /var/home/vaslim/Projects/allthepreaching/be
node scripts/migrateMariaDbToPostgres.js --import-docs
```

### Rebuild local target from scratch before import

```bash
cd /var/home/vaslim/Projects/allthepreaching/be
node scripts/migrateMariaDbToPostgres.js --truncate --import-docs
```

### Tune the import batch size if needed

```bash
cd /var/home/vaslim/Projects/allthepreaching/be
node scripts/migrateMariaDbToPostgres.js --batch-size=250 --import-docs
```

### Index subtitles into Postgres with tracker state

```bash
cd /var/home/vaslim/Projects/allthepreaching/be
SUBTITLE_LIBRARY_ROOT=/var/videos \
npm run db:postgres:index-subtitles
```

### Reindex one video against a custom subtitle root

```bash
cd /var/home/vaslim/Projects/allthepreaching/be
node scripts/indexSubtitlesToPostgres.js --video-id=8792471 --root=/tmp/atp-subtitles
```

## Validated working result

Validated on 2026-05-01 against the live MariaDB source and the local Postgres 18 container.

Successful command:

```bash
cd /var/home/vaslim/Projects/allthepreaching/be
node scripts/migrateMariaDbToPostgres.js --truncate --import-docs
```

Observed result:

1. `videos` imported: `15839`
2. `docs_upload` imported: `30`
3. rows with raw date preserved and `published_at = null`: `10355`

Representative invalid source rows:

1. `id=1000045`, `date=0000-00-00`
2. `id=1001369`, `date=0000-00-00`
3. `id=1001939`, `date=0000-00-00`

This confirms the importer correctly handles MariaDB zero-date placeholders by preserving the original value in `videos.date` and not forcing an invalid Postgres `date` value into `published_at`.

## What the schema currently does

### `videos`

- preserves the original `date` column as text for compatibility
- adds `published_at date` for normalized querying when parsing succeeds
- adds `search_document tsvector`
- adds a trigger that rebuilds `search_document` from weighted text fields
- adds a trigger that maintains `updated_at`

### `docs_upload`

- mirrors the legacy `docsUpload` table for compatibility and archival use

### `subtitle_documents`, `index_file`, `index_item`

- store cue-level subtitle rows in Postgres for backend-owned subtitle search
- track per-file hashes, processed state, deletion state, and last indexing timestamp
- delete cue rows when the subtitle file disappears so the filesystem and database remain the source of truth

## Current limitations

1. `pgvector` is not enabled here because the plain `postgres:18` image does not provide it by default
2. rows with invalid source dates stay preserved in `videos.date` and get `published_at = null`
3. subtitle indexing currently derives `.vtt` paths from `videos.vid_url`, so the subtitle library root must mirror the served video path layout

## Recommended next validation

1. run the importer into local Postgres
2. run subtitle indexing against the local subtitle root
3. verify `subtitle_documents` row counts for a few known files
4. remove a subtitle file and rerun the indexer to confirm cleanup

## Backend validation on Postgres

The backend now supports a local Postgres mode through [be/db.js](/var/home/vaslim/Projects/allthepreaching/be/db.js) and [be/config.js](/var/home/vaslim/Projects/allthepreaching/be/config.js).

Validated startup command:

```bash
DB_CLIENT=postgres \
USE_MOCK_DB=false \
TARGET_PGHOST=127.0.0.1 \
TARGET_PGPORT=5432 \
TARGET_PGUSER=atp_postgres \
TARGET_PGPASSWORD=atp_postgres_dev \
TARGET_PGDATABASE=allthepreaching \
PORT=3101 \
NEXT_PUBLIC_API_URL=http://localhost:3101 \
node /var/home/vaslim/Projects/allthepreaching/be/server.js
```

Validated behavior:

1. `/health` returns `200`
2. `/api/videos?limit=3` returns Postgres-backed video rows
3. `/api/categories` returns category aggregates from Postgres
4. `/api/preachers` returns preacher aggregates from Postgres
5. `/api/videos/8792471` returns a detail row and increments `clicks`
6. the persisted `clicks` value for `id=8792471` became `1` after the detail request

## Backend full-text search on Postgres

The backend fallback search in [be/routes/search.js](/var/home/vaslim/Projects/allthepreaching/be/routes/search.js) now uses Postgres search features when `DB_CLIENT=postgres`:

1. `videos.search_document` with `websearch_to_tsquery('simple', ...)`
2. `pg_trgm` similarity and `%` matching as a fuzzy fallback
3. ranking by lexical rank first, fuzzy similarity second, then recency
4. `subtitle_documents.search_document` for backend-owned subtitle search with the same Postgres stack

Validated example queries against the imported local Postgres copy:

1. `/api/search?q=Nehemiah%204&limit=5`
2. `/api/search?q=Adrian%20Balic&limit=5`
3. `/api/search?q=casualty&limit=5`

Observed behavior:

1. exact and near-exact title matches rank first
2. preacher-name searches return the preacher's videos without needing subtitle search service availability
3. fuzzy term variants like `casualty` still return related titles such as `Casual Casualties`

## Subtitle indexing and subtitle search validation

Validated on 2026-05-01 against local Postgres using a real imported `videos.id=8792471` row and a temporary `.vtt` file rooted under `/tmp/atp-subtitles`.

Validated indexing command:

```bash
cd /var/home/vaslim/Projects/allthepreaching/be
node scripts/indexSubtitlesToPostgres.js --video-id=8792471 --root=/tmp/atp-subtitles
```

Observed indexing result:

1. first run indexed `2` subtitle cue rows into `subtitle_documents`
2. second run skipped the file because the content hash was unchanged
3. after deleting the `.vtt` file and rerunning, `subtitle_documents` rows for `video_pk=8792471` were removed and `index_file.file_deleted` became `true`

Validated subtitle search command against a fresh backend process on port `3005`:

```bash
curl "http://127.0.0.1:3005/api/search?mode=subtitles&query=First"
```

Observed result:

1. response mode was `subtitles`
2. total hits was `1`
3. returned row included `videoId=8792471`, `subtitlePath`, `cueIndex=0`, `timestamp=1`, and `text="First subtitle line."`
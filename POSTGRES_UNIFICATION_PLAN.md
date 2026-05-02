# MariaDB to Postgres Unification Plan

## Scope

This plan covers three repositories that currently depend on the same video metadata model in different ways:

1. `allthepreaching/be` uses MariaDB directly for the production `videos` table.
2. `ATP-manager-aio` reads and writes the same `videos` table through Python + `pymysql`.
3. `subtitle_fts` uses MySQL/MariaDB for indexing-tracker tables and Elasticsearch for subtitle/category search.

Target state:

- one Postgres instance is the system of record
- `allthepreaching` and `ATP-manager-aio` both use Postgres for video metadata
- `allthepreaching/be` owns public search execution
- subtitle indexing logic from `subtitle_fts` is reused or ported, but not kept as a separate required runtime for search execution
- the same Postgres instance stores:
  - video metadata
  - subtitle/indexing tables
  - full-text search data
  - optional vector similarity data via `pgvector`
- MariaDB and Elasticsearch are fully removed after cutover validation

Additional operating constraints from the current requirements:

- the workload is strongly read-heavy and low-write
- new rows are added only when new videos are published, roughly under 100 rows per week
- most updates are lightweight mutations such as view counts
- Postgres will run in an AlmaLinux VM with XFS inside the guest, backed by ZFS on the Proxmox host, using Docker/Podman Compose for deployment

## Current Observations

### Live MariaDB schema

The remote MariaDB configured in `allthepreaching/be/.env` currently contains only two tables:

1. `videos`
2. `docsUpload`

Current `videos` DDL on the remote database:

```sql
CREATE TABLE `videos` (
  `id` int(11) NOT NULL,
  `vid_category` varchar(150) DEFAULT NULL,
  `search_category` varchar(150) DEFAULT NULL,
  `vid_preacher` varchar(150) DEFAULT NULL,
  `name` varchar(500) DEFAULT NULL,
  `vid_title` varchar(500) DEFAULT NULL,
  `vid_code` varchar(500) DEFAULT NULL,
  `date` varchar(50) DEFAULT NULL,
  `vid_url` varchar(500) DEFAULT NULL,
  `thumb_url` varchar(500) DEFAULT NULL,
  `pic_url` varchar(500) DEFAULT NULL,
  `header_url` varchar(500) DEFAULT NULL,
  `video_id` varchar(150) DEFAULT NULL,
  `profile_id` varchar(50) DEFAULT NULL,
  `main_category` varchar(150) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `clicks` int(11) NOT NULL,
  `shorts` tinyint(1) DEFAULT 0,
  `language` varchar(10) DEFAULT 'en',
  `runtime_minutes` decimal(8,2) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

Current `docsUpload` DDL on the remote database:

```sql
CREATE TABLE `docsUpload` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) DEFAULT NULL,
  `link` varchar(255) DEFAULT NULL,
  `code` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=MyISAM AUTO_INCREMENT=31 DEFAULT CHARSET=utf8mb3 COLLATE=utf8mb3_general_ci;
```

Important findings:

- the only index on either live table is the primary key
- `videos.date` is stored as `varchar(50)` even though the app sorts and filters on it as if it were a date
- `videos.created_at` mutates on every update because of `ON UPDATE current_timestamp()`, which is not a true creation timestamp
- `videos.id` is not auto-incrementing in MariaDB; callers appear to supply IDs
- `docsUpload` appears legacy and is not referenced by the current Node backend code

### allthepreaching

Observed behavior in `allthepreaching/be`:

- direct `mysql2/promise` usage in the shared pool
- all public video APIs query `videos` directly
- queries depend heavily on:
  - `LIKE`
  - `ORDER BY date DESC`
  - `LIMIT/OFFSET`
  - `COUNT(*)`
- one MySQL-specific query hint is already present: `/*+ MAX_EXECUTION_TIME(5000) */`
- subtitle search is proxied to `subtitle_fts`, but a DB fallback search still exists in `be/routes/search.js`
- clone endpoints expose database contents for mirroring

### ATP-manager-aio

Observed behavior in `ATP-manager-aio`:

- direct `pymysql` usage in:
  - `src/app/db_manager.py`
  - `src/app/stages/stage3.py`
  - `src/app/stages/stage5.py`
  - several API routes in `src/app/api/routes.py`
- stage 3 prepares raw SQL `INSERT INTO videos (...) VALUES (...)`
- stage 5 replays generated SQL files into the database
- database settings are persisted in `database_config.json`
- UI text and APIs assume MySQL/MariaDB explicitly

This repo is not only a reader. It is part of the write path for new `videos` rows, so schema changes must be reflected here first-class rather than patched in downstream.

### subtitle_fts

Observed behavior in `subtitle_fts`:

- Spring Boot app uses JPA for tracker tables:
  - `index_file`
  - `index_file_category`
  - `index_item`
- it uses Elasticsearch repositories for search documents:
  - `SubtitleRepository`
  - `CategoryInfoRepository`
- search endpoints are simple:
  - fuzzy search: subtitle text / video name query
  - exact search: subtitle text and/or category info filter
- search results are grouped by `subtitlePath` and then returned as media records
- the search API contract is narrow enough that internals can be replaced without changing callers

What is currently indexed into Elasticsearch:

1. subtitle documents
  - `id`
  - `categoryInfo`
  - `subtitlePath`
  - `videoDate`
  - `author`
  - `title`
  - `videoId`
  - `timestamp`
  - `text`
2. category documents
  - `id`
  - `categoryInfo`
  - `subtitlePath`
  - `videoDate`
  - `author`
  - `title`
  - `videoId`

Important detail:

- the indexer does not fetch additional metadata from the database while indexing
- it reads VTT cues and a neighboring JSON sidecar file
- the JSON sidecar provides metadata through fields like `sql_params`, `target_directory_relative`, and `target_vtt_filename`
- tracker tables in MySQL are used only for file-change tracking and indexing state, not as the source of canonical video metadata

## Schema Problems Worth Fixing During Migration

This migration should not be a byte-for-byte engine swap. The current schema has several issues that should be corrected while preserving compatibility at the API level.

## Read-Heavy Design Priority

Because the system is read-heavy and write-light, design choices should bias toward read performance, ranking quality, and operational simplicity rather than minimizing write amplification.

That changes the migration priorities:

1. add the right read indexes early, even if inserts become slightly more expensive
2. prefer precomputed search columns such as `tsvector` over computing search expressions on every request
3. accept denormalized helper columns where they materially improve query latency
4. treat view-count updates as the main write hot spot and isolate them from the rest of the read path where practical

Recommended read-optimized decisions:

1. keep a materialized `search_document` column on `videos`
2. keep dedicated search tables for subtitles and category metadata instead of joining back to raw tracker tables on each search
3. add covering indexes for the most common browse paths:
  - latest videos
  - videos by preacher
  - videos by category
  - videos by language
4. consider moving `clicks` updates to batched async flushes later if row-update churn becomes visible

For now, because writes are rare, normal row updates for `clicks` are acceptable, but the schema should avoid making every other read path pay for them.

### `videos` table improvements

Recommended changes:

1. Change `date` from `varchar(50)` to `date` or `timestamptz`.
2. Split `created_at` into:
   - `created_at` as immutable insert timestamp
   - `updated_at` as mutable last-update timestamp
3. Convert `shorts` to `boolean`.
4. Convert `profile_id` from `varchar(50)` to an integer or UUID if it is truly numeric/relational.
5. Decide whether `id` remains caller-supplied or becomes generated by Postgres sequence/identity.
6. Add uniqueness where the data model expects it, likely at least one of:
   - `video_id`
   - `vid_url`
   - a composite natural key if duplicates are intentionally allowed
7. Add indexes that match actual access patterns.

Recommended baseline indexes for Postgres:

```sql
create index videos_vid_preacher_idx on videos (vid_preacher);
create index videos_vid_category_idx on videos (vid_category);
create index videos_search_category_idx on videos (search_category);
create index videos_language_idx on videos (language);
create index videos_date_desc_idx on videos (date desc);
create index videos_created_at_desc_idx on videos (created_at desc);
create index videos_clicks_desc_idx on videos (clicks desc);
create index videos_video_id_idx on videos (video_id);
create index videos_vid_url_idx on videos (vid_url);
```

For the current read profile, also consider these two indexes immediately:

```sql
create index videos_preacher_date_idx on videos (vid_preacher, date desc);
create index videos_category_date_idx on videos (vid_category, date desc);
```

These match the dominant browse queries more directly than single-column indexes alone.

Recommended text-search helpers on `videos`:

```sql
alter table videos add column search_document tsvector;
create index videos_search_document_gin_idx on videos using gin (search_document);
```

Populate `search_document` from the text fields currently searched in app code:

- `vid_title`
- `name`
- `vid_preacher`
- `vid_category`
- `search_category`

Recommended improvement:

- maintain `videos.search_document` with a trigger or generated update path, not ad hoc batch logic only
- weight the fields so title and preacher rank above broader category text
- keep this logic in one DB-side function so imports and application writes produce the same search vector

### `docsUpload` decision

Because `docsUpload` does not appear in the current Node backend code, decide this before implementation:

1. If it is dead data, archive it and exclude it from the new application schema.
2. If it is used by an external legacy PHP surface, migrate it to Postgres as a compatibility table.

Do not silently drop it before confirming whether the old site or an external process still depends on it.

### Normalize categories and preachers carefully

The codebase already hints that preacher/category consolidation is desired. This migration is the right point to formalize it, but only if done in a compatibility-safe way.

Recommended approach:

1. Keep the existing `videos` columns for compatibility during the first migration.
2. Introduce normalized lookup tables only as additive schema in phase 1 or 2.
3. Backfill them from existing strings.
4. Keep denormalized columns or compatibility views until all repos stop depending on raw strings.

Suggested future tables:

- `preachers`
- `categories`
- optional mapping tables if one video can map to multiple categories later

## Proposed Target Postgres Design

### Phase 1 target: compatibility-first

Start with a Postgres `videos` table that preserves the current contract closely enough that all three repos can be migrated with minimal behavioral change.

Suggested compatibility-first shape:

```sql
create table videos (
  id integer primary key,
  vid_category text,
  search_category text,
  vid_preacher text,
  name text,
  vid_title text,
  vid_code text,
  date date,
  vid_url text,
  thumb_url text,
  pic_url text,
  header_url text,
  video_id text,
  profile_id text,
  main_category text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  clicks integer not null default 0,
  shorts boolean not null default false,
  language varchar(10) not null default 'en',
  runtime_minutes numeric(8,2)
);
```

Add a trigger to maintain `updated_at`.

If some existing `date` values are not valid ISO dates, use this safer intermediate shape during import:

- `date_raw text`
- `published_at date null`

Then backfill clean dates and eventually replace application reads.

### Search tables in Postgres

Replace Elasticsearch documents with Postgres tables.

Suggested tables:

1. `subtitle_documents`
2. keep or refactor the tracker tables:
   - `index_file`
   - `index_file_category`
   - `index_item`

Important design change for the new platform:

- use Postgres `videos` as the canonical source for video metadata
- use the `videos` table as the canonical source of what should be indexed at all
- use subtitle search tables for subtitle text and subtitle-position search only
- do not treat the subtitle index as the primary source of title, author, artwork, URLs, language, runtime, or category metadata
- category/title/author browse and metadata lookup should come from `videos`

Suggested `subtitle_documents` shape:

```sql
create extension if not exists vector;

create table subtitle_documents (
  id text primary key,
  subtitle_path text not null,
  category_info text,
  video_date timestamptz,
  author text,
  title text,
  video_id text,
  timestamp_seconds double precision not null,
  text text not null,
  search_document tsvector,
  embedding vector(768)
);

create index subtitle_documents_search_document_gin_idx
  on subtitle_documents using gin (search_document);

create index subtitle_documents_subtitle_path_idx
  on subtitle_documents (subtitle_path);

create index subtitle_documents_video_date_idx
  on subtitle_documents (video_date desc);
```

Notes:

- `search_document` handles fast exact/lexical search via Postgres full-text search.
- `embedding` enables semantic retrieval with `pgvector`.
- if embedding generation is not ready on day one, keep the column nullable and launch with lexical search first.
- because the system is read-heavy, favor precomputed embeddings and precomputed `tsvector` columns instead of generating either at query time.

Recommended linkage to canonical metadata:

```sql
alter table subtitle_documents
  add column video_pk integer references videos(id);

create index subtitle_documents_video_pk_idx
  on subtitle_documents (video_pk);
```

The preferred source of truth should be:

1. `subtitle_documents`
   - subtitle text
   - subtitle timestamp
   - search helper fields needed for ranking
2. `videos`
   - all canonical video metadata and presentation fields
  - the canonical list of indexable videos
  - the canonical subtitle location anchor through `vid_url`

That means the query flow should be:

1. search `subtitle_documents`
2. collect matching `video_pk` values
3. fetch or join canonical metadata from `videos`
4. return enriched results without making the subtitle index the owner of non-subtitle metadata

For category-only or metadata-only queries, query `videos` directly using full-text search on `videos.search_document` instead of a separate `category_documents` table.

That same rule should apply during ingestion:

1. query `videos` to determine which records are eligible for indexing
2. derive the expected subtitle file path from the canonical video link in `videos.vid_url`
3. parse the subtitle file only if it exists and is newer than the tracked index state
4. write subtitle rows keyed back to the canonical `videos.id`

## Target Service Consolidation

The long-term search platform should live inside `allthepreaching/be` as the public search surface.

Current state:

- the current search implementation lives in the separate `subtitle_fts` repository
- `allthepreaching/be` already exposes `/api/search`

Recommended path:

1. treat `subtitle_fts` as the source implementation to mine for logic and API behavior
2. port only the useful behavior into `allthepreaching/be` and nearby modules:
  - file tracking
  - subtitle parsing flow
  - search API contract
  - grouping logic for subtitle hits
3. do not carry over Elasticsearch-specific architecture unless a thin compatibility shim is temporarily needed during transition

This also changes how search data should be modeled:

1. subtitle text is indexed separately
2. canonical video metadata remains in `videos`
3. `be` search handlers should join or hydrate from `videos` instead of storing a second competing copy of metadata

This gives one operational runtime for search execution and removes the need for a separate search service in production.

## Refactor Plan by Repository

### 1. allthepreaching

#### Backend driver and DB layer

Replace `mysql2` with a Postgres client and put SQL differences behind one shared DB abstraction.

Recommended approach:

1. Replace direct pool construction with `pg` or a query-builder layer.
2. Keep route-level SQL shape mostly the same first.
3. Remove MySQL-only query hints.
4. Normalize placeholders from `?` to Postgres parameter style.

Files to touch first:

- `be/db.js`
- `be/config.js`
- `be/migrate.js`
- all files under `be/routes/` that query `videos`

Specific SQL differences to account for:

1. placeholders change from `?` to `$1`, `$2`, ...
2. booleans return real `true/false` instead of MySQL tinyint conventions
3. `MAX_EXECUTION_TIME` hint must be removed
4. date comparisons become typed comparisons instead of string ordering

#### Search fallback and API behavior

The DB fallback search in `be/routes/search.js` should move from plain `LIKE` search to either:

1. Postgres full-text search on `videos.search_document`, or
2. a simpler `ILIKE` fallback during the first cutover phase

Preferred end state:

- lexical keyword search in Postgres for fallback/basic search
- subtitle search executed by `be`, backed by the same Postgres instance

### 2. ATP-manager-aio

This repo must stop generating MySQL-shaped SQL.

#### Database connectivity

Replace `pymysql` with `psycopg` or `psycopg_pool`.

Core change areas:

- `src/app/db_manager.py`
- `src/app/stages/stage3.py`
- `src/app/stages/stage5.py`
- `src/app/api/routes.py`
- UI copy in `src/app/ui/templates/index.html`
- config persistence in `src/app/config.py` and backup docs

#### Stage 3 / Stage 5 redesign

Current design:

- stage 3 writes raw SQL files
- stage 5 replays them

That is fragile for a database migration because SQL files are dialect-specific.

Recommended redesign:

1. Replace raw SQL file generation with a structured job payload format, for example JSON lines.
2. Store typed insert/update payloads rather than literal SQL strings.
3. Let stage 5 build and execute Postgres statements using the active DB adapter.

If a short-term compatibility step is needed, stage 3 may still write SQL files, but they must be Postgres dialect only and no longer rely on `mogrify` from a MySQL cursor.

#### Application-level data fixes

This repo is the best place to enforce upstream cleanup before inserts:

1. validate `date` before writing
2. normalize `language`
3. decide whether `profile_id` is numeric or string
4. avoid generating duplicate rows where `video_id` or `vid_url` is already present

### 3. subtitle_fts

This repo should be treated as the reference implementation for behavior and indexing logic, then mined and folded into the `allthepreaching/be` search stack.

#### Replace MySQL datasource with Postgres datasource

Initial changes:

1. switch Spring datasource URL to Postgres
2. replace MySQL dialect config with Postgres dialect
3. swap runtime dependency from `mysql-connector-j` to the PostgreSQL JDBC driver

#### Remove Elasticsearch repositories

Current Elasticsearch repositories:

- `SubtitleRepository`
- `CategoryInfoRepository`

Replace them with one of these strategies:

1. Spring Data JPA repositories over Postgres tables plus custom native queries for FTS and vector search
2. JDBC-based repository classes for the search-heavy operations

Preferred split:

- keep JPA for tracker tables
- use custom SQL repositories for search queries, because Postgres FTS + vector search will likely need explicit SQL anyway

#### Recreate current search behavior in Postgres

Current behavior to preserve:

1. fuzzy search over subtitle text and title-like metadata
2. exact search filtered by `categoryInfo`
3. group results by `subtitlePath`
4. return media-level records with attached subtitle snippets

Current data sourcing behavior to preserve only temporarily, not permanently:

1. subtitle indexing reads sidecar JSON metadata generated by the video-processing pipeline
2. indexing does not look up the `videos` table for additional metadata

Recommended new behavior:

1. subtitle indexing should start from `videos`
2. subtitle file discovery should be derived from `videos.vid_url`
3. sidecar JSON should be transitional or fallback-only, not the primary source of indexing decisions
4. canonical metadata should be read from `videos`
5. search responses should be hydrated from `videos` for non-subtitle fields

Proposed Postgres search mapping:

1. exact search
   - use `plainto_tsquery` or `websearch_to_tsquery`
   - rank with `ts_rank`
2. fuzzy lexical fallback
   - use `pg_trgm` with `similarity()` or `%` operator
3. semantic expansion
   - generate embeddings for query text and search `embedding <=> query_embedding`
4. hybrid ranking
   - combine lexical rank and vector similarity into one score

Recommended query split:

1. subtitle-text search
  - query `subtitle_documents`
  - join to `videos` on `video_pk`
2. metadata/category search
  - query `videos.search_document`
  - no subtitle table required unless subtitle snippets are also requested

Suggested extension set:

```sql
create extension if not exists pg_trgm;
create extension if not exists vector;
```

#### Indexer redesign

The indexing pipeline should no longer treat filesystem sidecars as the primary source of truth. In the new design, it should be driven by the canonical `videos` rows and use filesystem subtitle files as the content source.

Recommended flow:

1. read candidate rows from `videos`
2. for each video row, derive the expected subtitle file path from `vid_url`
3. parse the subtitle file when present
4. write subtitle rows to `subtitle_documents`
5. upsert tracker state keyed by `videos.id` and the subtitle file path

Suggested subtitle path derivation rule:

1. map `videos.vid_url` back to a library-relative media path
2. replace the media extension with `.vtt`
3. resolve that path under the configured subtitle/library root

If current data still depends on sidecar JSON for some path details, treat that as a migration bridge only. The target state should allow the indexer to answer "what should I index?" and "where is its subtitle file?" directly from `videos` plus deterministic path rules.

Persistence changes:

1. write subtitle rows to `subtitle_documents`
2. store the `videos.id` reference as `video_pk` whenever it is known
3. keep tracker tables for change detection and cleanup
4. replace Elasticsearch delete/update calls with Postgres `insert ... on conflict ... do update` and targeted deletes

Do not duplicate every metadata field into subtitle rows unless it is required for ranking or query filtering. In the new design, the subtitle index should carry only what it needs to search and map back to the canonical `videos` row.

Recommended tracker model changes:

1. track by `video_pk` first, file path second
2. store the last known subtitle path, subtitle file mtime, checksum, and indexed_at timestamp
3. let a changed `vid_url` or missing subtitle file trigger re-resolution of the subtitle location

#### New target layout

Instead of continuing to evolve `subtitle_fts` as the production home, port the needed code into `allthepreaching/be` and supporting modules.

Suggested responsibility split inside `allthepreaching`:

1. `be/routes/search.js` and related modules own public search API behavior
2. shared indexing code owns `videos`-driven VTT ingestion
3. Postgres search tables stay in the main Postgres instance
4. embedding generation, if kept, is a library or worker concern rather than a separate mandatory runtime

## Migration Sequence

### Phase 0: confirm data contract

Before code changes:

1. export MariaDB schema and row counts
2. sample `videos.date` values and classify invalid rows
3. detect duplicate `video_id`, duplicate `vid_url`, and duplicate `id`
4. confirm whether `docsUpload` is still needed
5. choose `profile_id` canonical type

Recommended checks:

```sql
select count(*) from videos;
select count(*) from videos where date is null or trim(date) = '';
select date, count(*) from videos group by date order by count(*) desc limit 50;
select video_id, count(*) from videos group by video_id having count(*) > 1;
select vid_url, count(*) from videos group by vid_url having count(*) > 1;
```

### Phase 1: provision Postgres schema

1. create Postgres database
2. enable required extensions:
   - `pg_trgm`
   - `vector`
3. create compatibility-first `videos` table
4. create tracker tables
5. create `subtitle_documents` and add `videos.search_document`
6. create indexes and triggers
7. add read-optimized composite indexes before application cutover

### Phase 2: migrate data

1. export MariaDB `videos`
2. transform rows into Postgres-compatible types
3. import to Postgres staging tables first
4. validate row counts and key uniqueness
5. import or archive `docsUpload`
6. backfill `search_document`
7. backfill subtitle search rows from existing VTT artifacts or rerun the indexer

### Phase 3: refactor applications

Recommended order:

1. `allthepreaching/be`
  - own metadata search and future subtitle search execution here
  - port useful behavior from `subtitle_fts`
  - eliminate Elasticsearch dependency early
2. `ATP-manager-aio`
  - production write and maintenance path
3. `subtitle_fts`
  - treat as reference code to port, not as the target runtime

Alternative order if ingestion is more urgent:

1. `ATP-manager-aio`
2. `allthepreaching/be`
3. `subtitle_fts` behavior porting for subtitle indexing/search inside `be`

The better sequence depends on whether the immediate risk is read downtime or ingestion downtime.

### Phase 4: parallel run

Run a temporary dual-validation period:

1. keep the current production setup in place while Postgres is provisioned and populated
2. do not redeploy the production backend just to partially adopt Postgres
3. build and validate the Postgres-backed backend with both metadata search and future subtitle-search ownership in parallel
4. compare API results between MariaDB-backed and Postgres-backed backends
5. compare search results between the old search stack and the Postgres-backed backend search path
6. compare insert results from ATP-manager-aio in a staging environment

### Phase 5: cutover

1. keep MariaDB and the current search stack live until Postgres is fully populated and validated
2. freeze MariaDB writes for the shortest possible final sync window
3. run the final delta sync into Postgres
4. redeploy `allthepreaching/be` with the new Postgres connection
5. switch `ATP-manager-aio` to Postgres
6. validate counts, API responses, and search results after cutover
7. keep MariaDB and Elasticsearch available for rollback until the rollback window expires
10. decommission MariaDB and Elasticsearch only after rollback approval

## Postgres Tuning for HDD on ZFS

Because the database will live on HDD storage with ZFS underneath an AlmaLinux VM, the plan should optimize for predictable I/O and avoid pretending the storage is low-latency SSD.

### Storage assumptions

1. guest filesystem: XFS
2. host storage: ZFS on Proxmox
3. container runtime: Docker or Podman Compose
4. workload: read-heavy, low-write, moderate search indexing

### Practical tuning direction

Recommended initial Postgres tuning goals:

1. prioritize cache effectiveness over aggressive background write pressure
2. use conservative autovacuum tuning so dead tuples from view-count updates do not accumulate
3. avoid overly large `shared_buffers` in a VM on HDD-backed storage
4. treat `effective_cache_size` as relatively large if the VM has spare RAM and the working set is mostly cached
5. keep WAL/checkpoint settings tuned to reduce random I/O spikes

Recommended starting point, to be tuned against actual VM RAM:

```conf
shared_buffers = 2GB
effective_cache_size = 6GB
work_mem = 16MB
maintenance_work_mem = 512MB
random_page_cost = 2.5
effective_io_concurrency = 16
wal_compression = on
checkpoint_timeout = 15min
max_wal_size = 4GB
min_wal_size = 1GB
checkpoint_completion_target = 0.9
default_statistics_target = 200
autovacuum_vacuum_scale_factor = 0.02
autovacuum_analyze_scale_factor = 0.01
```

These are starting values only. Final numbers must match the VM's actual RAM and the size of the subtitle corpus.

### ZFS-specific guidance

Recommended host-side and deployment assumptions to document in the rollout:

1. use a dedicated dataset for Postgres data
2. set `recordsize=16K` on the Postgres dataset if operationally acceptable
3. set `atime=off`
4. strongly consider `logbias=latency`
5. do not stack unnecessary filesystem caching layers blindly; verify memory pressure across ZFS ARC and guest RAM

### View-count write strategy

Because the system is read-heavy and HDD-backed, repeated single-row updates for `clicks` are the most likely avoidable source of churn.

Plan recommendation:

1. phase 1: keep direct `UPDATE videos SET clicks = clicks + 1` for compatibility
2. phase 2: consider a lightweight buffering approach:
  - append click deltas to Redis or in-memory queue
  - flush to Postgres every N seconds
  - update `videos.clicks` in batches

This is optional, not required for the initial migration.

## Container and Compose Planning

No compose files are being changed in this phase, but the implementation plan should include container-level changes in the next phase.

### allthepreaching compose target

The final `allthepreaching` compose stack should gain:

1. `postgres`
2. updated `backend` environment pointing to Postgres for both metadata and search execution

### subtitle_fts compose retirement

The current `subtitle_fts` compose files are only useful as reference during the port. The target platform should not keep separate MariaDB and Elasticsearch services once the new stack exists.

### Podman-specific notes

When the implementation phase starts, the compose files should prefer:

1. explicit volume mounts for Postgres data
2. healthchecks for Postgres and FTS
3. memory limits appropriate for the VM
4. optional `security_opt` or SELinux-compatible volume labeling for AlmaLinux/Podman
5. environment variables for Postgres tuning and connection pooling

## Rollback Strategy

Rollback must be explicit because this is a multi-repo, shared-schema migration.

Recommended rollback assets:

1. MariaDB logical dump before cutover
2. Postgres dump after import and before go-live
3. application config snapshots from ATP-manager-aio backup/export
4. deployable last-known-good images for all three repos

Rollback rule:

- until all three repos pass validation in production, MariaDB remains restorable and Elasticsearch remains available

## Validation Checklist

### Data validation

1. `videos` row count matches source
2. no missing primary keys
3. duplicate policy for `video_id` and `vid_url` is enforced as designed
4. `date` parsing failures are accounted for and logged
5. subtitle document counts match indexing expectations
6. each indexed subtitle row can be mapped back to a canonical `videos` row
7. each indexable `videos` row resolves to the expected subtitle file path from `vid_url`

### API validation

1. `GET /api/videos` returns same results and pagination order
2. `GET /api/videos/:id` works and still increments clicks correctly
3. category and preacher endpoints return same aggregates
4. clone endpoints return equivalent datasets
5. RSS feeds still produce valid dates and ordering

### Search validation

1. exact subtitle queries return same or better hits
2. category-only queries still work
3. fuzzy queries do not regress badly on common phrases
4. result grouping by subtitle path is preserved
5. vector-assisted ranking is measurable and optional behind a feature flag initially

## Recommended Implementation Decisions

These are the decisions I recommend locking before writing code:

1. Postgres should become the only write target. Do not keep long-term multi-master writes to MariaDB and Postgres.
2. Preserve the current `videos` table shape first, then normalize incrementally.
3. Treat `date` cleanup as part of the migration, not a later task.
4. Replace ATP-manager-aio raw SQL files with typed job payloads as soon as practical.
5. Replace Elasticsearch-backed search execution with Postgres lexical search inside `allthepreaching/be` first, then add embeddings as a second step if timeline is tight.
6. Keep search API contracts stable while changing storage internals.
7. Keep `subtitle_fts` as reference code only; do not make it a required production runtime after cutover.
8. Tune Postgres and deployment defaults for HDD-backed ZFS rather than copying SSD-oriented defaults.
9. Treat `videos` as the source of truth for non-subtitle metadata; the subtitle index should not own presentation metadata.
10. Drive indexing from `videos`, and derive subtitle file paths from `vid_url` rather than from ad hoc sidecar discovery.

## Open Questions

These need answers before implementation starts:

1. Should `videos.id` remain externally assigned, or can Postgres own identity generation?
2. Is `video_id` expected to be globally unique?
3. Is `vid_url` expected to be globally unique?
4. Are there legacy non-ISO `date` values that must be preserved exactly as strings?
5. Is `docsUpload` still required by any legacy PHP or operational workflow?
6. What embedding model and dimensionality should be used for `pgvector`?
7. Does subtitle search need semantic ranking on day one, or is lexical parity first acceptable?

## Recommended First Implementation Milestones

1. Create Postgres DDL and import scripts for `videos` and `docsUpload`.
2. Port the useful subtitle search and indexing behavior from `subtitle_fts` into `allthepreaching/be`.
3. Add read-optimized indexes and FTS structures in Postgres before application cutover.
4. Define the deterministic rule that maps `videos.vid_url` to a subtitle `.vtt` path.
5. Design `subtitle_documents` to reference canonical `videos.id` values.
6. Add a Postgres-backed DB adapter to `allthepreaching/be` behind a minimal abstraction.
7. Refactor ATP-manager-aio stage 3 and stage 5 away from raw MySQL SQL files.
8. Prepare compose changes for Podman/AlmaLinux deployment with Postgres tuning and healthchecks.
9. Run side-by-side validation against production data before cutover.
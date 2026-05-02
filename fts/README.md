# FTS Indexer

This service is the dedicated subtitle indexing worker for ALLthePREACHING.

It is intentionally separate from `be`.

Responsibilities:

- read canonical video rows from Postgres
- resolve subtitle files from `videos.vid_url`
- index cue rows into `subtitle_documents`
- maintain tracker state in `index_file` and `index_item`
- remove index data for deleted videos or missing subtitle files
- run on intervals without overlapping jobs

It is not a public search API.

## Why keep it separate

`be` should own search execution and response contracts.

This worker can then focus on throughput and file-system access:

- raw local file access
- long-running interval jobs
- batch inserts
- no user-facing latency concerns

## Tracking strategy

The efficient tracking model is:

1. use Postgres `videos.updated_at` to discover new or metadata-updated sermons
2. keep per-file tracker rows keyed by `video_pk`
3. store cheap filesystem facts in the tracker:
   - `file_path`
   - `subtitle_path`
   - `file_size`
   - `file_mtime`
   - `source_updated_at`
4. on interval runs, use cheap `stat` checks on tracked files
5. only hash and re-parse subtitle content when size or mtime changed
6. delete subtitle rows when the source file disappears or the video row is removed

That avoids reading or hashing every subtitle file on every run.

## Run locally

```bash
cd /var/home/vaslim/Projects/allthepreaching/fts
mvn spring-boot:run
```

Useful environment variables:

- `SPRING_DATASOURCE_URL`
- `SPRING_DATASOURCE_USERNAME`
- `SPRING_DATASOURCE_PASSWORD`
- `INDEXER_SUBTITLE_ROOT`
- `INDEXER_SCAN_CRON`
- `INDEXER_TRACKED_FILE_CRON`
- `INDEXER_CLEANUP_CRON`

Default subtitle root is set to the repo-local corpus path for local testing.

## Why the old implementation is not copied wholesale

The original `subtitle_fts` runtime included web APIs, security, Swagger, Elasticsearch repositories, and MySQL-specific persistence.

Those are intentionally not ported here.

The parts still worth keeping were already absorbed into this worker design:

- scheduled non-overlapping indexing jobs
- tracker tables for incremental processing
- direct VTT ingestion
- cleanup of deleted content

What remains in the old repo is mostly runtime baggage for a search API that now belongs in `be`.

## Compose and Podman notes

The main compose stack now builds this worker from `fts/Dockerfile`.

The subtitle corpus bind mount uses `:ro,Z` so Podman can relabel the mount for container access on SELinux-enabled hosts while still keeping the corpus read-only.
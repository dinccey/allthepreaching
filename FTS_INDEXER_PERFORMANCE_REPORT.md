# FTS Indexer Performance Report

## Scope

- Date: 2026-05-02
- Database: PostgreSQL 18 on `127.0.0.1:5432`
- Corpus root: `subtitles_corpus/captions_backup2025`
- Videos in DB: `15,839`
- Subtitle files on disk: `16,373`

## Dataset Findings

- `322` subtitle files are mapped by more than one video row. These are now flagged as duplicate mappings and skipped for subtitle document ownership.
- `4,622` tracker rows ended in `file_deleted = true` with a missing subtitle-file error.
- `4,944` tracker rows have a non-null `processing_error` after the full run. This includes duplicate mappings and missing-file cases.
- `7,556,596` subtitle cue documents were indexed.
- `7,556,596` `index_item` rows were created.

## Indexing Benchmarks

### Full Initial Index

- Command mode: startup one-shot index run against a clean `index_file`, `index_item`, and `subtitle_documents` state
- Real time: `5126.62s` (`85.44m`)
- User CPU: `322.64s`
- System CPU: `23.24s`
- Peak RSS: `322,728 KB`

### Empty Reindex

- Command mode: startup one-shot incremental run with scheduling disabled and no source changes
- Real time: `2.25s`
- User CPU: `4.68s`
- System CPU: `0.19s`
- Peak RSS: `191,660 KB`
- Result: no count drift

### Small Reindex

- Test shape: `30` already indexed, non-duplicate, non-deleted tracker rows were marked stale by forcing `index_file.source_updated_at` to epoch
- Real time: `14.62s`
- User CPU: `12.93s`
- System CPU: `0.27s`
- Peak RSS: `240,484 KB`
- Result: all `30` rows were reprocessed and the system returned to steady state with `0` stale clean rows remaining

### Tracker Mutation Tests

- Test sample videos: `1000045`, `1001369`, `1001716`
- Baseline cue counts: `498`, `46`, `23`

#### Move Files Out Of Corpus

- Action: moved the three `.vtt` files out of the local corpus and ran a one-shot incremental pass
- Real time: `2.44s`
- Result: all three tracker rows flipped to `file_deleted = true`, all three subtitle-document sets were removed, and no unrelated clean rows became stale

#### Restore Files To Corpus

- Action: restored the three `.vtt` files and reran a one-shot incremental pass
- Initial finding: restored files were not reindexed automatically because deleted tracker rows were not eligible in the normal candidate query
- Fix: `VideoSourceRepository` now treats `file_deleted = true` trackers as candidates for the standard incremental pass
- Fixed rerun real time: `9.50s`
- Result after fix: all three tracker rows returned to `file_deleted = false` and the restored documents were reindexed

#### Modify A Tracked File

- Action: appended one extra cue to the `1000045` subtitle file, then restored the original file contents afterward
- Initial finding: startup one-shot runs only exercised `runIncrementalIndexing()`, so pure file-content changes on already tracked rows were not covered deterministically
- Fix: added startup mode selection so one-shot runs can execute tracked-file refresh directly
- Second finding during tracked refresh validation: the old refresh branch bypassed `processCandidate()` and could still hit duplicate-key collisions on duplicate-mapped subtitle paths
- Fix: `refreshTrackedFile()` now delegates to `processCandidate()` so duplicate and missing-file handling stay consistent
- Tracked-file refresh real time after fix: `15.49s`
- Final result: the injected test cue was removed again after restoring the original file, the sample row returned to `498` cues, and duplicate mappings were logged as warnings instead of aborting the refresh path

## Search Benchmark

## Important Note

The backend was already using Postgres full text primitives:

- `tsvector` columns
- `websearch_to_tsquery('simple', ...)`
- `ts_rank_cd(...)`
- GIN indexes on `search_document`

The problem was that the original query shape mixed FTS with trigram similarity in one large `OR` predicate. On the large subtitle table that caused PostgreSQL to choose a parallel sequential scan, which defeated the intended FTS index path.

The backend route was corrected to use proper FTS-driven predicates in [be/routes/search.js](/var/home/vaslim/Projects/allthepreaching/be/routes/search.js).

### Before Query Fix

- Video search for `salvation`: `135.972 ms`
- Plan shape: sequential scan on `videos`
- Subtitle search for `salvation`: `42,786.687 ms`
- Plan shape: parallel sequential scan on `subtitle_documents`

### After Query Fix

- Video search for `salvation`: `1.919 ms`
- Plan shape: bitmap heap scan using `videos_search_document_gin_idx`
- Subtitle search for `salvation` with category filter `Shelley`: `371.329 ms`
- Plan shape: parallel bitmap heap scan using `subtitle_documents_search_document_gin_idx`, then category filter
- Subtitle distinct-video count for `salvation` with category filter `Shelley`: `450.285 ms`
- Broad FTS-only subtitle search for `salvation` without category filter: `1,898.533 ms`

## Interpretation

- Incremental behavior is working as intended. The no-op run is cheap, and a targeted 30-item refresh stays in the low-second range.
- Corpus mutation handling now behaves correctly for delete, restore, and tracked-file refresh cases.
- The full initial indexing cost is dominated by corpus size and cue-volume, not by tracker bookkeeping.
- Duplicate subtitle-file ownership is a real source-data issue, not an indexer bug. The new duplicate-flagging path prevented full-run aborts.
- Proper Postgres FTS is now being used by the backend search path. The main search regression came from blending FTS and trigram predicates in one `OR` clause, not from missing FTS infrastructure.
- Two tracker-path bugs were found and fixed during live corpus mutation testing:
	- restored files were skipped because deleted trackers were not re-eligible in the normal candidate query
	- tracked-file refresh had a divergent control path that bypassed duplicate handling and could still collide on unique subtitle-file ownership

## Follow-up Recommendations

- Keep subtitle-query matching FTS-first unless there is a measured reason to reintroduce fuzzy fallback.
- If fuzzy fallback is needed later, run it as a second-stage query instead of combining it with the main FTS predicate.
- Treat `index_file` and filesystem state as the source of truth for incremental indexing; that model performed well in the no-op and small-delta runs.
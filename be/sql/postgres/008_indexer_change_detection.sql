-- Migration 008: make subtitle change detection honest, and resumable
--
-- Three defects, all measured on production (16,619 videos, 15,613 of them
-- marked "Subtitle file missing" while 24 of 25 sampled paths existed and read
-- back as WEBVTT inside the indexer's own container):
--
-- 1. videos_set_updated_at fired on ANY column update, so the play counter
--    (be/routes/videos.js: UPDATE videos SET clicks = clicks + 1) bumped
--    updated_at. The indexer's candidate gate compares
--    v.updated_at > f.source_updated_at, so ordinary traffic marked ~9.7k of
--    16.6k videos as edited, and each one cost a full re-parse of the caption
--    file plus a delete + re-insert of its cue rows. That is why the tracked-file
--    refresh crawled at ~175 rows/hour, never finished, and starved the
--    incremental scan behind the shared mutex.
--
-- 2. Nothing in the candidate set covered a tracker row that had simply never
--    produced documents. Failures and duplicate mappings are written with
--    processed=true and file_deleted=false, so no later run looked at them again
--    (measured on prod: index_file rows with processed=false is 0, i.e. the queue
--    is "empty" and every latched row stays latched forever). "Has no rows in
--    subtitle_documents" is the state that actually matters, so the Java
--    candidate query gains that condition and re-checks it on every run.
--
-- 3. The tracked-file refresh restarts at index_file id 0 on each invocation with
--    no bound, so a pass that cannot finish inside its window can never make
--    forward progress. A persisted cursor gives it a resume point.
--
-- Concurrency note: the scan and the refresh deliberately still share one mutex.
-- Both call processCandidate(), which deletes and re-inserts rows in
-- subtitle_documents and index_item (unique on document_id) and upserts
-- index_file on conflict (video_pk). Two concurrent passes over the same video
-- would raise unique violations, and recordFailure() would then latch the row as
-- processed=true. Bounding the refresh is what removes the starvation, not
-- letting the two jobs overlap.
--
-- This file is transaction-safe on purpose: it creates no indexes (the
-- subtitle_documents.video_pk btree its NOT EXISTS clause leans on belongs to
-- 004), so it needs neither CREATE INDEX CONCURRENTLY nor pgm.noTransaction().

-- (1) Re-scope the trigger to the columns the indexer actually denormalises into
-- subtitle_documents. video_id is in the list because VideoCandidate reads it and
-- it feeds the document's video_url. clicks, date, name, main_category, pic_url,
-- profile_id, shorts and header_url are not consumed by the indexer, so they no
-- longer mark a video as changed.
--
-- Identical to the definition in 001_init.sql, which a fresh install runs first;
-- the two must match or the trigger flaps on every fresh database.
drop trigger if exists videos_set_updated_at on videos;
create trigger videos_set_updated_at
before update of vid_url, thumb_url, vid_title, vid_preacher, vid_category, search_category, video_id, language, runtime_minutes, published_at, created_at
on videos
for each row
execute function atp_set_updated_at();

-- (3) Resume point for the bounded tracked-file refresh. indexer_state already has
-- one row per named job; the cursor rides along with its status, so a restart
-- continues where it stopped instead of starting over at id 0.
alter table indexer_state
  add column if not exists refresh_cursor bigint not null default 0;

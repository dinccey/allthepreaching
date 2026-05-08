-- Migration 005: Index on subtitle_documents.video_date for capped recent-first scan
-- atp:no-transaction
--
-- WHY: The subtitle search video_page CTE aggregates ALL matching cues
-- (COUNT(*), MAX(ts_rank_cd)) before applying LIMIT. For very common terms
-- like "God" or "faith" this can be 2–5 million rows, causing 10+ second
-- queries even with the GIN index.
--
-- The fix in search.js wraps the inner scan with:
--   ORDER BY video_date DESC NULLS LAST LIMIT 50000
-- which caps the aggregation to at most 50,000 rows.
--
-- For this to be fast on common terms, PostgreSQL must walk the video_date
-- index in descending order and apply the tsvector filter as a post-filter
-- (index scan → post-filter, stopping after 50,000 hits). Without this index
-- the inner ORDER BY would require sorting all matching rows first — still O(N).
--
-- For rare terms the GIN index on text_tsvector is still used (fewer than
-- 50,000 rows match, so the LIMIT never kicks in and GIN wins on cost).
--
-- CONCURRENTLY: non-blocking build — hence atp:no-transaction.

create index concurrently if not exists subtitle_documents_video_date_desc_idx
  on subtitle_documents (video_date desc nulls last);

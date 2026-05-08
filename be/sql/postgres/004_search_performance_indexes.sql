-- Migration 004: Add missing indexes for fast full-text search
-- atp:no-transaction
--
-- WHY THIS IS NEEDED:
--
-- 1. videos.search_document (GIN index)
--    The buildPostgresVideoSearch query uses:
--      WHERE search_document @@ websearch_to_tsquery('simple', $1)
--    Without a GIN index this is a full sequential scan of the entire videos
--    table on every search request. A GIN index turns this into a bitmap scan.
--
-- 2. subtitle_documents.video_pk (btree index)
--    The subtitle search outer query is:
--      SELECT sd.* FROM subtitle_documents sd
--      JOIN video_page vp ON sd.video_pk = vp.video_pk
--      WHERE sd.text_tsvector @@ websearch_to_tsquery(...)
--    video_page is a small CTE (~20 video_pk values after LIMIT). Without an
--    index on video_pk the planner may prefer a bitmap scan on the GIN
--    index (scanning ALL matching cues for a common word like "God") and then
--    filtering by video_pk. With the btree index the planner uses a nested-loop
--    join: for each of the ~20 video_pks fetch its cues via the btree index,
--    then filter by tsvector. This is O(20 × cues_per_video) instead of
--    O(all_matching_cues_in_table).
--
-- Both indexes are built CONCURRENTLY to avoid blocking reads/writes.
-- CONCURRENTLY is illegal inside a transaction block → atp:no-transaction.

-- 1. GIN index on videos.search_document
create index concurrently if not exists videos_search_document_gin_idx
  on videos using gin (search_document);

-- 2. btree index on subtitle_documents.video_pk
create index concurrently if not exists subtitle_documents_video_pk_idx
  on subtitle_documents (video_pk);

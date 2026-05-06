-- Migration 003: btree index on subtitle_documents.category_slug
-- atp:no-transaction
-- Supports exact-match preacher/category filtering in caption search
-- (sd.category_slug = $N) without a sequential scan.
-- CONCURRENTLY: non-blocking build, cannot run inside a transaction block.

create index concurrently if not exists subtitle_documents_category_slug_idx
  on subtitle_documents (category_slug);

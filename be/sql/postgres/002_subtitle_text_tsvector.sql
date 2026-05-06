-- Migration 002: Add stored text_tsvector column to subtitle_documents
-- atp:no-transaction
--
-- WHY: The old approach used an expression GIN index:
--   CREATE INDEX ... USING GIN (to_tsvector('simple', coalesce(text, '')))
-- This allowed fast WHERE-clause bitmap scans but still required Postgres to
-- recompute to_tsvector(text) for EVERY matching row at ranking time (ts_rank_cd).
-- For a corpus with thousands of subtitle cues, this is expensive on each search.
--
-- The new approach stores the tsvector as a generated column. to_tsvector() is
-- computed once on INSERT/UPDATE and stored in the heap. GIN index built on the
-- column (not an expression). ts_rank_cd reads the pre-built value from the heap.
--
-- Requires PostgreSQL 12+.
-- NOTE: ADD COLUMN GENERATED ALWAYS AS STORED rewrites the whole table (full
-- table scan + AccessExclusiveLock). On large tables this will block until done.
-- CREATE INDEX CONCURRENTLY builds the index without blocking reads/writes.
-- This file is marked atp:no-transaction because CONCURRENTLY is illegal inside
-- a transaction block.
--
-- Run time: may be slow on large tables (backfills all rows). Consider running
--   node be/db-migrate.js
-- manually during a low-traffic window before deploying.

-- Step 1: add the stored generated column.
-- GENERATED ALWAYS AS STORED: value computed on INSERT/UPDATE, stored physically.
-- IF NOT EXISTS guard prevents failure if migration is re-run.
alter table subtitle_documents
  add column if not exists text_tsvector tsvector
  generated always as (to_tsvector('simple', coalesce(text, ''))) stored;

-- Step 2: Drop the old expression-based GIN index if it exists.
-- The old index covered the expression to_tsvector('simple', coalesce(text, ''))
-- which is NOT usable for queries on the stored text_tsvector column. Dropping it
-- allows us to create the correct index on the column itself.
-- IF EXISTS: safe no-op if already dropped or never existed.
drop index concurrently if exists subtitle_documents_text_tsvector_gin_idx;

-- Step 3: Create the new GIN index on the stored column using CONCURRENTLY so
-- the build does not block reads/writes on subtitle_documents.
-- (CONCURRENTLY cannot run inside a transaction block — hence atp:no-transaction.)
create index concurrently if not exists subtitle_documents_text_tsvector_gin_idx
  on subtitle_documents using gin (text_tsvector);

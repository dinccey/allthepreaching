// Migration 002: add stored text_tsvector column to subtitle_documents
//
// The old approach used an expression GIN index:
//   CREATE INDEX ... USING GIN (to_tsvector('simple', coalesce(text, '')))
// which allowed fast WHERE-clause bitmap scans but still made Postgres recompute
// to_tsvector(text) for EVERY matching row at ranking time (ts_rank_cd) — expensive
// per search on a corpus of millions of cues. Storing the tsvector as a generated
// column computes it once on INSERT/UPDATE, lets the GIN index sit on the column
// rather than an expression, and lets ts_rank_cd read the value off the heap.
//
// Requires PostgreSQL 12+.
//
// Locking: ADD COLUMN GENERATED ALWAYS AS STORED rewrites the whole table
// (full scan + ACCESS EXCLUSIVE) and backfills every row, so on a large table this
// blocks until done — run it in a low-traffic window. The index build is
// CONCURRENTLY so it does not block reads or writes.
exports.up = async (pgm) => {
    // CONCURRENTLY is illegal inside a transaction block, so this migration opts
    // out of one. Statements are sent individually on purpose: several statements
    // in a single simple-query round trip form an implicit transaction block,
    // which would fail for exactly the same reason.
    pgm.noTransaction();

    await pgm.sql(`
        alter table subtitle_documents
          add column if not exists text_tsvector tsvector
          generated always as (to_tsvector('simple', coalesce(text, ''))) stored
    `);

    // The old expression-based index is not usable for queries on the stored
    // column, so it is dropped before the column-based one is built.
    await pgm.sql(`drop index concurrently if exists subtitle_documents_text_tsvector_gin_idx`);

    await pgm.sql(`
        create index concurrently subtitle_documents_text_tsvector_gin_idx
          on subtitle_documents using gin (text_tsvector)
    `);
};

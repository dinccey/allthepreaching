// Migration 005: index on subtitle_documents.video_date for the capped
// recent-first scan
//
// The subtitle search's video_page CTE aggregates ALL matching cues
// (COUNT(*), MAX(ts_rank_cd)) before applying LIMIT. For very common terms like
// "God" or "faith" that is 2–5 million rows, so queries took 10+ seconds even
// with the GIN index.
//
// search.js caps it by wrapping the inner scan with
//   ORDER BY video_date DESC NULLS LAST LIMIT 50000
// which bounds the aggregation to at most 50,000 rows.
//
// For that to be fast on common terms, PostgreSQL must walk the video_date index
// in descending order and apply the tsvector filter as a post-filter (index scan
// → post-filter, stopping after 50,000 hits). Without this index the inner
// ORDER BY would sort every matching row first — still O(N).
//
// For rare terms the GIN index on text_tsvector is still chosen (fewer than
// 50,000 rows match, so the LIMIT never kicks in and GIN wins on cost).
exports.up = async (pgm) => {
    // CONCURRENTLY: non-blocking build, illegal inside a transaction block.
    pgm.noTransaction();

    await pgm.sql(`
        create index concurrently if not exists subtitle_documents_video_date_desc_idx
          on subtitle_documents (video_date desc nulls last)
    `);
};

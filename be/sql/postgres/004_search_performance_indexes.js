// Migration 004: indexes the two search paths were missing
//
// 1. videos.search_document (GIN)
//    buildPostgresVideoSearch filters with
//      WHERE search_document @@ websearch_to_tsquery('simple', $1)
//    Without a GIN index that is a full sequential scan of videos on every
//    search request; with one it becomes a bitmap scan.
//
// 2. subtitle_documents.video_pk (btree)
//    The subtitle search outer query is
//      SELECT sd.* FROM subtitle_documents sd
//      JOIN video_page vp ON sd.video_pk = vp.video_pk
//      WHERE sd.text_tsvector @@ websearch_to_tsquery(...)
//    video_page is a small CTE (~20 video_pk values after LIMIT). Without an
//    index on video_pk the planner prefers a bitmap scan on the GIN index —
//    scanning ALL matching cues for a common word like "God" and filtering by
//    video_pk afterwards. With the btree index it uses a nested loop: for each of
//    the ~20 video_pks fetch that video's cues, then filter by tsvector. That is
//    O(20 × cues_per_video) instead of O(all matching cues in the table).
//
// 008's candidate clause (NOT EXISTS on subtitle_documents.video_pk) depends on
// index 2, so 004 must stay ordered before it.
exports.up = async (pgm) => {
    // CONCURRENTLY: non-blocking builds, illegal inside a transaction block.
    pgm.noTransaction();

    await pgm.sql(`
        create index concurrently if not exists videos_search_document_gin_idx
          on videos using gin (search_document)
    `);

    await pgm.sql(`
        create index concurrently if not exists subtitle_documents_video_pk_idx
          on subtitle_documents (video_pk)
    `);
};

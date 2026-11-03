// Migration 003: btree index on subtitle_documents.category_slug
//
// Supports exact-match preacher/category filtering in caption search
// (sd.category_slug = $N) without a sequential scan.
exports.up = async (pgm) => {
    // CONCURRENTLY: non-blocking build, illegal inside a transaction block.
    pgm.noTransaction();

    await pgm.sql(`
        create index concurrently if not exists subtitle_documents_category_slug_idx
          on subtitle_documents (category_slug)
    `);
};

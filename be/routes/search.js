/**
 * Search proxy routes
 * Proxy requests to separate search service
 */
const express = require('express');
const router = express.Router();
const config = require('../config');

const isPostgres = config.database.client === 'postgres';

const parseLimit = (value, fallback = 24, max = 200) => {
    const parsed = parseInt(value, 10);
    if (Number.isNaN(parsed) || parsed < 0) {
        return fallback;
    }
    return Math.min(parsed, max);
};

const parseOffset = (value) => {
    const parsed = parseInt(value, 10);
    if (Number.isNaN(parsed) || parsed < 0) {
        return 0;
    }
    return parsed;
};

const buildPostgresVideoSearch = ({ query, dateFrom, dateTo, limit, offset }) => {
    const safeDateFrom = dateFrom || null;
    const safeDateTo = dateTo || null;

    const sql = `
        WITH ranked AS (
            SELECT
                *,
                ts_rank_cd(search_document, websearch_to_tsquery('simple', ?)) AS rank_score,
                0::double precision AS similarity_score
            FROM videos
            WHERE
                (? = '' OR search_document @@ websearch_to_tsquery('simple', ?))
                AND (?::date IS NULL OR published_at >= ?::date)
                AND (?::date IS NULL OR published_at <= ?::date)
        )
        SELECT *
        FROM ranked
        ORDER BY rank_score DESC, similarity_score DESC, published_at DESC NULLS LAST, date DESC
        LIMIT ? OFFSET ?
    `;

    const countSql = `
        SELECT COUNT(*) AS total
        FROM videos
        WHERE
            (? = '' OR search_document @@ websearch_to_tsquery('simple', ?))
            AND (?::date IS NULL OR published_at >= ?::date)
            AND (?::date IS NULL OR published_at <= ?::date)
    `;

    return {
        sql,
        countSql,
        listParams: [query, query, query, safeDateFrom, safeDateFrom, safeDateTo, safeDateTo, limit, offset],
        countParams: [query, query, safeDateFrom, safeDateFrom, safeDateTo, safeDateTo],
    };
};

/**
 * Optimised subtitle search scoped to a single video.
 * Skips the video_page CTE pagination and returns cues ordered by timestamp.
 */
// Budget for search statements. Every other route in the API goes through the
// db adapter with an explicit timeout; search passed a bare SQL string, which the
// adapter maps to `query_timeout: undefined` - i.e. unbounded. An unplanned scan
// over subtitle_documents then ran for minutes and queued behind each concurrent
// search until the host saturated (seen on prod 2026-11-04: ten 4-minute count
// queries at once, load 7.5 on 3 cores, and Postgres failing other queries with
// 53100 "No space left on device" from /dev/shm pressure by parallel workers).
const SEARCH_QUERY_TIMEOUT_MS = parseInt(process.env.SEARCH_QUERY_TIMEOUT_MS || '15000', 10);

// GIN-indexable text predicate.
//
// This used to read `(? = '' OR col @@ websearch_to_tsquery('simple', ?))` so an
// empty query meant "no text restriction". The planner cannot treat a bound
// parameter's comparison as constant, so the disjunction as a whole is not
// indexable and it evaluated websearch_to_tsquery() for EVERY row of
// subtitle_documents (9.7M on prod) - a multi-minute sequential scan. Building the
// condition per request keeps identical semantics (no text filter when there is no
// query) while a real query can use subtitle_documents_text_tsvector_gin_idx.
// The trailing `params` must be spread into the positional argument list exactly
// where the fragment was interpolated.
const textMatchCondition = (column, query) => {
    const normalized = (query || '').trim();
    return {
        fragment: normalized ? `${column} @@ websearch_to_tsquery('simple', ?)` : 'TRUE',
        params: normalized ? [normalized] : [],
    };
};

const buildPostgresVideoSubtitleSearch = ({ query, videoId, limit }) => {
    const normalizedQuery = (query || '').trim();
    const sdTextMatch = textMatchCondition('sd.text_tsvector', normalizedQuery);

    const sql = `
        SELECT
            sd.id,
            sd.video_pk AS "videoId",
            sd.subtitle_path AS "subtitlePath",
            sd.cue_index AS "cueIndex",
            sd.timestamp_seconds AS timestamp,
            sd.text,
            sd.title,
            sd.author,
            sd.category_name AS "categoryName",
            sd.category_slug AS "categorySlug",
            sd.video_url AS "videoUrl",
            sd.thumbnail_url AS "thumbnailUrl",
            sd.language,
            sd.runtime_minutes AS "runtimeMinutes",
            sd.category_info AS "categoryInfo",
            sd.video_date AS "videoDate",
            CASE WHEN ? <> ''
                 THEN ts_rank_cd(sd.text_tsvector, websearch_to_tsquery('simple', ?))
                 ELSE 0 END AS rank_score,
            0::double precision AS similarity_score
        FROM subtitle_documents sd
        WHERE sd.video_pk = ?
          AND ${sdTextMatch.fragment}
        ORDER BY sd.timestamp_seconds ASC
        LIMIT ?
    `;

    const countSql = `
        SELECT COUNT(*) AS total
        FROM subtitle_documents sd
        WHERE sd.video_pk = ?
          AND ${sdTextMatch.fragment}
    `;

    return {
        sql,
        countSql,
        listParams: [normalizedQuery, normalizedQuery, videoId, ...sdTextMatch.params, limit],
        countParams: [videoId, ...sdTextMatch.params],
    };
};

const buildPostgresSubtitleSearch = ({ query, categoryInfo, categorySlugs, dateFrom, dateTo, limit, offset }) => {
    const normalizedQuery = (query || '').trim();
    const normalizedCategoryInfo = (categoryInfo || '').trim();
    // categorySlugs is a string[] — empty array means no slug filter.
    // We pass it as a pg array param and use cardinality() = 0 as the "no filter" sentinel.
    const slugsArray = Array.isArray(categorySlugs) && categorySlugs.length > 0 ? categorySlugs : [];
    const categoryLike = `%${normalizedCategoryInfo}%`;
    // Date range: null means no bound (IS NULL check used as sentinel in SQL)
    const safeDateFrom = dateFrom || null;
    const safeDateTo = dateTo || null;
    // The CTE selects the column unqualified, the outer query and the count use sd.
    const cteTextMatch = textMatchCondition('text_tsvector', normalizedQuery);
    const sdTextMatch = textMatchCondition('sd.text_tsvector', normalizedQuery);

    // Two-phase CTE: paginate at the video level first, then fetch all cues for that page.
    // Text search uses sd.text_tsvector (stored generated GIN-indexed column, see migration 002).
    // text_tsvector contains ONLY the subtitle text (no author/title contamination), so
    // matching is purely content-based. To filter by preacher use:
    //   - categorySlugs: exact multi-slug filter via = ANY($N), cardinality = 0 = no restriction
    //   - categoryInfo: ILIKE fallback for legacy category browsing
    // Combined preacher+topic queries ("Paul Washer preaches repentance") work by
    // selecting a preacher CHIP on the results page and typing the topic in the search box;
    // this passes a categorySlugs filter alongside the text query.
    //
    // PERF: The inner subquery caps rows fed to the GROUP BY to 5,000.
    // For rare/specific terms (<5k matches) LIMIT never fires and results are exact.
    // For very common terms ("God", "Bible") this avoids aggregating millions of rows:
    //   - No ORDER BY: planner uses the GIN index (bitmap scan), reads heap in page order,
    //     stops after 5,000 rows. No full sort of the matching set required.
    //   - The sample is approximate but covers many distinct video_pks and is fast.
    //
    // total_videos: the count of distinct videos in that sampled set, taken from the
    // grouped rows before the page LIMIT (window functions run after GROUP BY). This
    // replaces a second query - `COUNT(*) FROM (SELECT DISTINCT video_pk ... LIMIT
    // 10001)` - which was the real cost for common terms: even with an indexable
    // predicate the GIN bitmap has to heap-read the whole match set out of an 18 GB
    // table, measured over 25s on prod for 'God'. Deriving the number from the same
    // sample the rows already come from adds no scan, and keeps total consistent with
    // what is returned (capped by the sample, exactly as the results already were).
    const sql = `
        WITH video_page AS (
            SELECT
                sd.video_pk,
                MAX(
                    CASE WHEN ? <> '' THEN ts_rank_cd(sd.text_tsvector, websearch_to_tsquery('simple', ?))
                         ELSE 0 END
                ) AS best_rank,
                COUNT(*) AS match_count,
                MAX(sd.video_date) AS video_date,
                COUNT(*) OVER () AS total_videos
            FROM (
                SELECT video_pk, text_tsvector, video_date
                FROM subtitle_documents
                WHERE ${cteTextMatch.fragment}
                AND (
                    (cardinality(?::text[]) = 0 OR category_slug = ANY(?::text[]))
                    AND (? = '' OR category_name ILIKE ? OR author ILIKE ?)
                )
                AND (?::date IS NULL OR video_date >= ?::date::timestamptz)
                AND (?::date IS NULL OR video_date < (?::date::timestamptz + INTERVAL '1 day'))
                LIMIT 5000
            ) sd
            GROUP BY sd.video_pk
            ORDER BY match_count DESC, best_rank DESC, video_date DESC NULLS LAST
            LIMIT ? OFFSET ?
        )
        SELECT
            sd.id,
            sd.video_pk AS "videoId",
            sd.subtitle_path AS "subtitlePath",
            sd.cue_index AS "cueIndex",
            sd.timestamp_seconds AS timestamp,
            sd.text,
            sd.title,
            sd.author,
            sd.category_name AS "categoryName",
            sd.category_slug AS "categorySlug",
            sd.video_url AS "videoUrl",
            sd.thumbnail_url AS "thumbnailUrl",
            sd.language,
            sd.runtime_minutes AS "runtimeMinutes",
            sd.category_info AS "categoryInfo",
            sd.video_date AS "videoDate",
            vp.best_rank AS rank_score,
            vp.total_videos AS "totalVideos",
            0::double precision AS similarity_score
        FROM subtitle_documents sd
        JOIN video_page vp ON sd.video_pk = vp.video_pk
        WHERE ${sdTextMatch.fragment}
        ORDER BY vp.match_count DESC, vp.best_rank DESC, vp.video_date DESC NULLS LAST, sd.timestamp_seconds ASC
    `;

    // No separate count query: see total_videos in the CTE above.
    return {
        sql,
        listParams: [
            normalizedQuery, normalizedQuery,   // CASE WHEN best_rank
            ...cteTextMatch.params,             // WHERE text tsvector (video_page CTE)
            slugsArray, slugsArray,             // cardinality / = ANY slug filter
            normalizedCategoryInfo, categoryLike, categoryLike, // AND categoryInfo ILIKE
            safeDateFrom, safeDateFrom,         // dateFrom IS NULL OR video_date >= dateFrom
            safeDateTo, safeDateTo,             // dateTo IS NULL OR video_date < dateTo + 1 day
            limit, offset,                      // LIMIT/OFFSET for video_page
            ...sdTextMatch.params,              // WHERE text tsvector (outer join filter)
        ],
    };
};

const groupSubtitleSearchResults = (rows) => {
    const grouped = new Map();

    rows.forEach((row) => {
        const groupKey = row.videoId || row.subtitlePath || row.id;
        const existing = grouped.get(groupKey);
        const subtitleHit = {
            timestamp: row.timestamp,
            text: row.text,
            cueIndex: row.cueIndex,
            rankScore: row.rank_score,
            similarityScore: row.similarity_score,
        };

        if (!existing) {
            grouped.set(groupKey, {
                videoId: row.videoId,
                subtitlePath: row.subtitlePath,
                title: row.title,
                author: row.author,
                categoryName: row.categoryName,
                categorySlug: row.categorySlug,
                videoUrl: row.videoUrl,
                thumbnailUrl: row.thumbnailUrl,
                language: row.language,
                runtimeMinutes: row.runtimeMinutes,
                categoryInfo: row.categoryInfo,
                videoDate: row.videoDate,
                subtitles: [subtitleHit],
                matchCount: 1,
                bestRankScore: Number(row.rank_score || 0),
                bestSimilarityScore: Number(row.similarity_score || 0),
            });
            return;
        }

        existing.subtitles.push(subtitleHit);
        existing.matchCount += 1;
        existing.bestRankScore = Math.max(existing.bestRankScore, Number(row.rank_score || 0));
        existing.bestSimilarityScore = Math.max(existing.bestSimilarityScore, Number(row.similarity_score || 0));
    });

    return Array.from(grouped.values())
        .map((group) => ({
            ...group,
            subtitles: group.subtitles.sort((left, right) => Number(left.timestamp) - Number(right.timestamp)),
        }))
        .sort((left, right) => {
            if (right.matchCount !== left.matchCount) {
                return right.matchCount - left.matchCount;
            }
            if (right.bestRankScore !== left.bestRankScore) {
                return right.bestRankScore - left.bestRankScore;
            }
            if (right.bestSimilarityScore !== left.bestSimilarityScore) {
                return right.bestSimilarityScore - left.bestSimilarityScore;
            }
            return new Date(right.videoDate || 0).getTime() - new Date(left.videoDate || 0).getTime();
        });
};

const swapExtension = (path, ext) => {
    if (!path) return null;
    const clean = path.split('?')[0];
    const dot = clean.lastIndexOf('.');
    if (dot === -1) return `${clean}${ext}`;
    return `${clean.slice(0, dot)}${ext}`;
};

const buildMediaUrl = (baseUrl, relativePath) => {
    if (!relativePath) return null;
    const trimmedBase = (baseUrl || '').replace(/\/$/, '');
    const trimmedPath = relativePath.replace(/^\//, '');
    return `${trimmedBase}/video/${trimmedPath}`;
};

const buildVideoCandidates = (subtitlePath, baseUrl) => {
    const mp4Path = swapExtension(subtitlePath, '.mp4');
    const mp4Url = buildMediaUrl(baseUrl, mp4Path);
    return {
        mp4Path,
        mp4Url,
    };
};

const chunkArray = (items, size) => {
    const chunks = [];
    for (let i = 0; i < items.length; i += size) {
        chunks.push(items.slice(i, i + size));
    }
    return chunks;
};

const resolveVideoIdsForSubtitles = async (items) => {
    const subtitlePaths = Array.from(
        new Set(items.map(item => item.subtitlePath).filter(Boolean))
    );

    if (!subtitlePaths.length) {
        return items;
    }

    const pool = require('../db');
    const rows = [];

    const batches = chunkArray(subtitlePaths, 50);
    for (const batch of batches) {
        const conditions = [];
        const params = [];

        batch.forEach((subtitlePath) => {
            const { mp4Path, mp4Url } = buildVideoCandidates(subtitlePath, config.video?.caddy?.baseUrl);
            if (mp4Path) {
                conditions.push('vid_url LIKE ?');
                params.push(`%/${mp4Path}`);
            }
            if (mp4Url) {
                conditions.push('vid_url = ?');
                params.push(mp4Url);
            }
        });

        const query = `SELECT id, vid_url FROM videos WHERE ${conditions.join(' OR ')}`;
        const [results] = await pool.query(query, params);
        rows.push(...results);
    }

    const matched = new Map();
    subtitlePaths.forEach((path) => {
        const { mp4Path, mp4Url } = buildVideoCandidates(path, config.video?.caddy?.baseUrl);
        const found = rows.find((row) => {
            const vidUrl = row.vid_url || '';
            return (
                (mp4Path && vidUrl.includes(mp4Path)) ||
                (mp4Url && vidUrl === mp4Url)
            );
        });
        if (found) {
            matched.set(path, found.id);
        }
    });

    return items.map((item) => ({
        ...item,
        videoId: matched.get(item.subtitlePath) || item.videoId
    }));
};

/**
 * GET /api/search
 * Proxy search requests to search microservice
 * Query params: q (query), limit, offset
 */
router.get('/', async (req, res) => {
    try {
        const {
            q,
            query,
            categoryInfo,
            categorySlug,
            videoId,
            dateFrom,
            dateTo,
            limit = 24,
            offset = 0,
            maxResults = 600,
            mode
        } = req.query;

        const subtitleQuery = query || q;
        const categoryInfoQuery = categoryInfo || req.query.search;
        // categorySlug may be a comma-separated list for multi-select filtering
        const categorySlugs = typeof categorySlug === 'string' && categorySlug.trim()
            ? categorySlug.split(',').map(s => s.trim()).filter(Boolean)
            : [];
        // mode=videos explicitly overrides the subtitle-search heuristic
        const isSubtitleSearch = mode === 'subtitles' || (mode !== 'videos' && (!!query || !!req.query['advanced-search']));

        // Date range: validate ISO date format (YYYY-MM-DD) to prevent injection
        const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
        const safeDateFrom = typeof dateFrom === 'string' && ISO_DATE_RE.test(dateFrom) ? dateFrom : null;
        const safeDateTo   = typeof dateTo   === 'string' && ISO_DATE_RE.test(dateTo)   ? dateTo   : null;

        // Per-video subtitle search: parse videoId as positive integer
        const parsedVideoId = typeof videoId === 'string' ? parseInt(videoId, 10) : NaN;
        const safeVideoId = !Number.isNaN(parsedVideoId) && parsedVideoId > 0 ? parsedVideoId : null;

        if (isSubtitleSearch) {
            if (!subtitleQuery && !categoryInfoQuery && !categorySlugs.length && !safeVideoId) {
                return res.status(400).json({ error: 'Query parameter "query", "categoryInfo", "categorySlug", or "videoId" is required for subtitle search' });
            }

            if (isPostgres) {
                const pool = require('../db');
                const safeLimit = parseLimit(limit, 50, 300);
                const safeOffset = parseOffset(offset);

                // Fast per-video path: skip the two-phase video_page CTE
                if (safeVideoId) {
                    const { sql, countSql, listParams, countParams } = buildPostgresVideoSubtitleSearch({
                        query: subtitleQuery || '',
                        videoId: safeVideoId,
                        limit: safeLimit,
                    });
                    const [flatResults] = await pool.query({ sql, timeout: SEARCH_QUERY_TIMEOUT_MS }, listParams);
                    const [[countRow]] = await pool.query({ sql: countSql, timeout: SEARCH_QUERY_TIMEOUT_MS }, countParams);
                    return res.json({
                        mode: 'subtitles',
                        results: flatResults.map(row => ({
                            videoId: row.videoId,
                            subtitlePath: row.subtitlePath,
                            title: row.title,
                            author: row.author,
                            categoryName: row.categoryName,
                            categorySlug: row.categorySlug,
                            videoUrl: row.videoUrl,
                            thumbnailUrl: row.thumbnailUrl,
                            language: row.language,
                            runtimeMinutes: row.runtimeMinutes,
                            categoryInfo: row.categoryInfo,
                            videoDate: row.videoDate,
                            timestamp: String(row.timestamp),
                            cueIndex: row.cueIndex,
                            text: row.text,
                            rankScore: Number(row.rank_score || 0),
                        })),
                        total: Number(countRow.total || 0),
                        limit: safeLimit,
                        offset: 0,
                        query: subtitleQuery,
                    });
                }

                const { sql, listParams } = buildPostgresSubtitleSearch({
                    query: subtitleQuery || '',
                    categoryInfo: categoryInfoQuery,
                    categorySlugs,
                    dateFrom: safeDateFrom,
                    dateTo: safeDateTo,
                    limit: safeLimit,
                    offset: safeOffset,
                });

                const [flatResults] = await pool.query({ sql, timeout: SEARCH_QUERY_TIMEOUT_MS }, listParams);
                // total_videos rides on every row (see the CTE); an empty result set
                // means nothing matched, so 0 is exact rather than a guess.
                const totalVideos = Number(flatResults[0]?.totalVideos || 0);
                const results = groupSubtitleSearchResults(flatResults);
                return res.json({
                    mode: 'subtitles',
                    results,
                    total: totalVideos,
                    limit: safeLimit,
                    offset: safeOffset,
                    query: subtitleQuery,
                    categoryInfo: categoryInfoQuery || ''
                });
            }

            const searchUrl = config.services.searchUrl;
            if (!searchUrl) {
                return res.status(503).json({ error: 'Search service is not configured' });
            }

            const response = await fetch(
                `${searchUrl}?query=${encodeURIComponent(subtitleQuery)}&categoryInfo=${encodeURIComponent(categoryInfoQuery || '')}&maxResults=${maxResults}`
            );

            if (!response.ok) {
                console.error(`Search service returned ${response.status}`);
                return res.status(503).json({
                    error: 'Caption search service is currently unavailable',
                    mode: 'subtitles',
                    results: [],
                    total: 0,
                });
            }

            const data = await response.json();
            const results = Array.isArray(data)
                ? await resolveVideoIdsForSubtitles(data)
                : [];
            return res.json({
                mode: 'subtitles',
                results,
                total: results.length,
                query: subtitleQuery,
                categoryInfo: categoryInfoQuery || ''
            });
        }

        if (!q && !query) {
            return res.status(400).json({ error: 'Query parameter "q" is required' });
        }

        // Fallback to DB search if search service not configured
        const pool = require('../db');
        const safeLimit = parseLimit(limit, 24, 200);
        const safeOffset = parseOffset(offset);
        const videoSearchTerm = (q || query || '').trim();
        let results;
        let total;

        if (isPostgres) {
            const { sql, countSql, listParams, countParams } = buildPostgresVideoSearch({
                query: videoSearchTerm,
                dateFrom: safeDateFrom,
                dateTo: safeDateTo,
                limit: safeLimit,
                offset: safeOffset,
            });

            [results] = await pool.query({ sql, timeout: SEARCH_QUERY_TIMEOUT_MS }, listParams);
            const [[countRow]] = await pool.query({ sql: countSql, timeout: SEARCH_QUERY_TIMEOUT_MS }, countParams);
            total = Number(countRow.total || 0);
        } else {
            [results] = await pool.query(
                `SELECT * FROM videos 
                 WHERE vid_title LIKE ? OR vid_preacher LIKE ? OR name LIKE ?
                 ORDER BY date DESC
                 LIMIT ? OFFSET ?`,
                [`%${videoSearchTerm}%`, `%${videoSearchTerm}%`, `%${videoSearchTerm}%`, safeLimit, safeOffset]
            );
            total = results.length;
        }

        const { createVideoProvider } = require('../providers/VideoProvider');
        const videoProvider = createVideoProvider(config.video);

        const videos = results.map(video => ({
            ...video,
            vid_url: videoProvider.getUrl(video.vid_url),
            thumb_url: video.thumb_url || videoProvider.getThumbnailUrl(video.vid_url)
        }));

        return res.json({
            mode: 'videos',
            results: videos,
            total,
            query: videoSearchTerm
        });
    } catch (error) {
        console.error('Error searching videos:', error);
        res.status(500).json({ error: 'Search failed' });
    }
});

module.exports = router;

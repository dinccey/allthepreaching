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

const buildPostgresVideoSearch = ({ query, limit, offset }) => {
    const sql = `
        WITH ranked AS (
            SELECT
                *,
                ts_rank_cd(search_document, websearch_to_tsquery('simple', ?)) AS rank_score,
                0::double precision AS similarity_score
            FROM videos
            WHERE
                ? = ''
                OR search_document @@ websearch_to_tsquery('simple', ?)
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
            ? = ''
            OR search_document @@ websearch_to_tsquery('simple', ?)
    `;

    return {
        sql,
        countSql,
        listParams: [query, query, query, limit, offset],
        countParams: [query, query],
    };
};

const buildPostgresSubtitleSearch = ({ query, categoryInfo, limit }) => {
    const normalizedQuery = (query || '').trim();
    const normalizedCategoryInfo = (categoryInfo || '').trim();
    const sql = `
        WITH ranked AS (
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
                CASE
                    WHEN ? <> '' THEN ts_rank_cd(sd.search_document, websearch_to_tsquery('simple', ?))
                    ELSE 0
                END AS rank_score,
                0::double precision AS similarity_score
            FROM subtitle_documents sd
            WHERE (
                ? = ''
                OR sd.search_document @@ websearch_to_tsquery('simple', ?)
            )
            AND (
                ? = ''
                OR COALESCE(sd.category_name, '') ILIKE ?
            )
        )
        SELECT *
        FROM ranked
        ORDER BY rank_score DESC, similarity_score DESC, "videoDate" DESC NULLS LAST, timestamp ASC
        LIMIT ?
    `;

    const countSql = `
        SELECT COUNT(DISTINCT sd.video_pk) AS total
        FROM subtitle_documents sd
        WHERE (
            ? = ''
            OR sd.search_document @@ websearch_to_tsquery('simple', ?)
        )
        AND (
            ? = ''
            OR COALESCE(sd.category_name, '') ILIKE ?
        )
    `;

    const categoryLike = `%${normalizedCategoryInfo}%`;
    return {
        sql,
        countSql,
        listParams: [
            normalizedQuery,
            normalizedQuery,
            normalizedQuery,
            normalizedQuery,
            normalizedCategoryInfo,
            categoryLike,
            limit,
        ],
        countParams: [
            normalizedQuery,
            normalizedQuery,
            normalizedCategoryInfo,
            categoryLike,
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
            limit = 24,
            offset = 0,
            maxResults = 600,
            mode
        } = req.query;

        const subtitleQuery = query || q;
        const categoryInfoQuery = categoryInfo || req.query.search;
        const isSubtitleSearch = mode === 'subtitles' || !!query || !!req.query['advanced-search'];

        if (isSubtitleSearch) {
            if (!subtitleQuery && !categoryInfoQuery) {
                return res.status(400).json({ error: 'Query parameter "query" or "categoryInfo" is required for subtitle search' });
            }

            if (isPostgres) {
                const pool = require('../db');
                const safeLimit = parseLimit(maxResults, 100, 1000);
                const { sql, countSql, listParams, countParams } = buildPostgresSubtitleSearch({
                    query: subtitleQuery || '',
                    categoryInfo: categoryInfoQuery,
                    limit: safeLimit,
                });

                const [flatResults] = await pool.query(sql, listParams);
                const [[countRow]] = await pool.query(countSql, countParams);
                const results = groupSubtitleSearchResults(flatResults);
                return res.json({
                    mode: 'subtitles',
                    results,
                    total: Number(countRow.total || 0),
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
                throw new Error(`Search service returned ${response.status}`);
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

        if (!q) {
            return res.status(400).json({ error: 'Query parameter "q" is required' });
        }

        // Fallback to DB search if search service not configured
        const pool = require('../db');
        const safeLimit = parseLimit(limit, 24, 200);
        const safeOffset = parseOffset(offset);
        let results;
        let total;

        if (isPostgres) {
            const search = q.trim();
            const { sql, countSql, listParams, countParams } = buildPostgresVideoSearch({
                query: search,
                limit: safeLimit,
                offset: safeOffset,
            });

            [results] = await pool.query(sql, listParams);
            const [[countRow]] = await pool.query(countSql, countParams);
            total = Number(countRow.total || 0);
        } else {
            [results] = await pool.query(
                `SELECT * FROM videos 
                 WHERE vid_title LIKE ? OR vid_preacher LIKE ? OR name LIKE ?
                 ORDER BY date DESC
                 LIMIT ? OFFSET ?`,
                [`%${q}%`, `%${q}%`, `%${q}%`, safeLimit, safeOffset]
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
            query: q
        });
    } catch (error) {
        console.error('Error searching videos:', error);
        res.status(500).json({ error: 'Search failed' });
    }
});

module.exports = router;

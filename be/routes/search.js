/**
 * Search proxy routes
 * Proxy requests to separate search service
 */
const express = require('express');
const router = express.Router();
const config = require('../config');

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
            if (!subtitleQuery) {
                return res.status(400).json({ error: 'Query parameter "query" is required for subtitle search' });
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

        // Fallback to simple DB search if search service not configured
        const pool = require('../db');
        const [results] = await pool.query(
            `SELECT * FROM videos 
             WHERE vid_title LIKE ? OR vid_preacher LIKE ? OR name LIKE ?
             ORDER BY date DESC
             LIMIT ? OFFSET ?`,
            [`%${q}%`, `%${q}%`, `%${q}%`, parseInt(limit, 10), parseInt(offset, 10)]
        );

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
            total: videos.length,
            query: q
        });
    } catch (error) {
        console.error('Error searching videos:', error);
        res.status(500).json({ error: 'Search failed' });
    }
});

module.exports = router;

/**
 * Video routes
 * Handle video listing, filtering, and metadata retrieval
 */
const express = require('express');
const { Readable } = require('stream');
const router = express.Router();
const pool = require('../db');
const config = require('../config');
const { createVideoProvider } = require('../providers/VideoProvider');

const videoProvider = createVideoProvider(config.video);

const MEDIA_RESPONSE_HEADERS = ['content-type', 'content-length', 'content-range', 'accept-ranges', 'last-modified', 'etag', 'cache-control'];
const PASSTHROUGH_REQUEST_HEADERS = ['range', 'if-none-match', 'if-modified-since'];
const LANGUAGE_REGEX = /^[a-z]{2}$/i;
const LENGTH_FILTERS = new Set(['short', 'long']);
const QUERY_TIMEOUT_MS = 15000;

const buildMediaPaths = (video) => {
    const base = `/api/videos/${video.id}`;
    return {
        stream: `${base}/video`,
        audio: `${base}/audio`,
        thumbnail: `${base}/thumbnail`,
        subtitles: `${base}/subtitles`
    };
};

const decorateVideoResponse = (video) => {
    const media = buildMediaPaths(video);
    return {
        ...video,
        stream_url: media.stream,
        audio_stream_url: media.audio,
        thumbnail_stream_url: media.thumbnail,
        subtitles_stream_url: media.subtitles
    };
};

const fetchVideoById = async (id) => {
    const [rows] = await pool.query('SELECT * FROM videos WHERE id = ?', [id]);
    return rows[0];
};

const swapExtension = (path, ext) => {
    if (!path) return null;
    const [cleanPath, query = ''] = path.split('?');
    const dot = cleanPath.lastIndexOf('.');
    const base = dot === -1 ? cleanPath : cleanPath.substring(0, dot);
    const updated = `${base}${ext}`;
    return query ? `${updated}?${query}` : updated;
};

const getThumbnailSource = (video) => {
    if (video.thumb_url) {
        return videoProvider.getUrl(video.thumb_url);
    }
    return videoProvider.getThumbnailUrl(video.vid_url);
};

const getAudioSource = (video) => {
    const candidate = video.audio_url || video.audio || swapExtension(video.vid_url, '.mp3');
    if (!candidate) {
        return null;
    }
    return videoProvider.getUrl(candidate);
};

const getSubtitleSource = (video) => {
    const candidate = video.subtitles_url || video.subtitle_url || swapExtension(video.vid_url, '.vtt');
    if (!candidate) {
        return null;
    }
    return videoProvider.getUrl(candidate);
};

const normalizeLanguage = (value) => {
    if (!value || typeof value !== 'string') return null;
    const trimmed = value.trim().toLowerCase();
    return LANGUAGE_REGEX.test(trimmed) ? trimmed : null;
};

const normalizeLengthFilter = (value) => {
    if (!value || typeof value !== 'string') return null;
    const trimmed = value.trim().toLowerCase();
    return LENGTH_FILTERS.has(trimmed) ? trimmed : null;
};

const buildVideoFilters = ({ preacher, category, search_category, language, length }) => {
    const filters = [];
    const params = [];

    if (preacher) {
        filters.push('vid_preacher = ?');
        params.push(preacher);
    }

    if (category) {
        filters.push('vid_category = ?');
        params.push(category);
    }

    if (search_category) {
        filters.push('search_category = ?');
        params.push(search_category);
    }

    const normalizedLanguage = normalizeLanguage(language);
    if (normalizedLanguage) {
        filters.push('language = ?');
        params.push(normalizedLanguage);
    }

    const normalizedLength = normalizeLengthFilter(length);
    if (normalizedLength === 'long') {
        filters.push('runtime_minutes >= ?');
        params.push(20);
    } else if (normalizedLength === 'short') {
        filters.push('runtime_minutes < ?');
        params.push(20);
    }

    const clause = filters.length ? ` AND ${filters.join(' AND ')}` : '';
    return { clause, params };
};

const getFilenameFromUrl = (url, fallback) => {
    if (!url) return fallback;
    try {
        const parsed = new URL(url);
        const path = parsed.pathname || '';
        const name = path.split('/').pop();
        return name ? decodeURIComponent(name) : fallback;
    } catch (error) {
        const clean = url.split('?')[0];
        const name = clean.split('/').pop();
        return name ? decodeURIComponent(name) : fallback;
    }
};

async function proxyMediaResponse(remoteInput, req, res, { contentType, filename } = {}) {
    const candidates = (Array.isArray(remoteInput) ? remoteInput : [remoteInput]).filter(Boolean);

    if (!candidates.length) {
        return res.status(404).json({ error: 'Media not available' });
    }

    const shouldDownload = req.query.download === '1' || req.query.download === 'true';
    if (shouldDownload) {
        const safeName = filename || getFilenameFromUrl(candidates[0], 'download');
        res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
    }

    let lastStatus = 502;
    let lastBody = 'Failed to proxy media';

    for (const remoteUrl of candidates) {
        try {
            const headers = {};
            PASSTHROUGH_REQUEST_HEADERS.forEach((header) => {
                if (req.headers[header]) {
                    headers[header] = req.headers[header];
                }
            });

            const upstream = await fetch(remoteUrl, { headers });
            lastStatus = upstream.status;

            if (!upstream.ok && upstream.status !== 206) {
                lastBody = (await upstream.text().catch(() => '')) || lastBody;
                continue;
            }

            res.status(upstream.status);

            MEDIA_RESPONSE_HEADERS.forEach(header => {
                const value = upstream.headers.get(header);
                if (value) {
                    res.setHeader(header, value);
                }
            });

            if (contentType && !upstream.headers.get('content-type')) {
                res.setHeader('Content-Type', contentType);
            }

            if (!upstream.body) {
                return res.end();
            }

            return Readable.fromWeb(upstream.body).pipe(res);
        } catch (error) {
            console.error('Error proxying media candidate %s:', remoteUrl, error);
            lastStatus = 502;
            lastBody = 'Failed to proxy media';
        }
    }

    return res.status(lastStatus).send(lastBody);
}

const queryWithTimeout = (sql, params) =>
    pool.query({ sql, timeout: QUERY_TIMEOUT_MS }, params);

/**
 * GET /api/videos
 * List videos with filtering and pagination
 * Query params: preacher, category, page, limit, sort
 */
router.get('/', async (req, res) => {
    try {
        const {
            preacher,
            category,
            search_category,
            language,
            length,
            page = 1,
            limit = 24,
            sort = 'date'
        } = req.query;

        const allowedLimits = [24, 48, 96];
        const legacyLimitMap = { 25: 24, 50: 48, 100: 96 };
        const requestedLimit = parseInt(limit, 10);
        const normalizedLimit = legacyLimitMap[requestedLimit] || requestedLimit;
        const pageSize = allowedLimits.includes(normalizedLimit) ? normalizedLimit : allowedLimits[0];
        const currentPage = Math.max(1, parseInt(page, 10) || 1);
        const offset = (currentPage - 1) * pageSize;

        const { clause, params: baseParams } = buildVideoFilters({ preacher, category, search_category, language, length });

        // Build dynamic query
        let query = `SELECT /*+ MAX_EXECUTION_TIME(5000) */ * FROM videos WHERE 1=1${clause}`;

        // Add sorting
        const sortColumn = sort === 'views' ? 'clicks' : 'date';
        query += ` ORDER BY ${sortColumn} DESC`;

        // Add pagination
        query += ' LIMIT ? OFFSET ?';
        const listParams = [...baseParams, pageSize, offset];

        const [rows] = await queryWithTimeout(query, listParams);

        // Attach proxied media paths
        const videos = rows.map(decorateVideoResponse);

        // Get total count for pagination
        const countQuery = `SELECT /*+ MAX_EXECUTION_TIME(5000) */ COUNT(*) as total FROM videos WHERE 1=1${clause}`;
        const [[{ total }]] = await queryWithTimeout(countQuery, baseParams);

        res.json({
            videos,
            pagination: {
                page: currentPage,
                limit: pageSize,
                total,
                totalPages: Math.ceil(total / pageSize)
            }
        });
    } catch (error) {
        console.error('Error fetching videos:', error);
        res.status(500).json({ error: 'Failed to fetch videos' });
    }
});

/**
 * GET /api/videos/languages
 * List available language codes
 */
router.get('/languages', async (req, res) => {
    try {
        const [rows] = await queryWithTimeout(
            "SELECT DISTINCT LOWER(language) as code FROM videos WHERE language IS NOT NULL AND language != '' ORDER BY code"
        );
        const languages = rows.map(row => row.code).filter(Boolean);
        res.json(languages);
    } catch (error) {
        console.error('Error fetching languages:', error);
        res.status(500).json({ error: 'Failed to fetch languages' });
    }
});

/**
 * GET /api/videos/:id
 * Get single video by ID with full metadata
 */
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const videoRow = await fetchVideoById(id);

        if (!videoRow) {
            return res.status(404).json({ error: 'Video not found' });
        }

        const video = decorateVideoResponse(videoRow);

        // Increment view count
        await pool.query('UPDATE videos SET clicks = clicks + 1 WHERE id = ?', [id]);

        res.json(video);
    } catch (error) {
        console.error('Error fetching video:', error);
        res.status(500).json({ error: 'Failed to fetch video' });
    }
});

/**
 * GET /api/videos/:id/recommendations
 * Get recommended videos (same preacher, sorted by date)
 */
router.get('/:id/recommendations', async (req, res) => {
    try {
        const { id } = req.params;
        const limit = parseInt(req.query.limit) || 10;

        // Get current video's preacher
        const videoRow = await fetchVideoById(id);

        if (!videoRow) {
            return res.status(404).json({ error: 'Video not found' });
        }

        // Get other videos from same preacher
        const [rows] = await pool.query(
            'SELECT * FROM videos WHERE vid_preacher = ? AND id != ? ORDER BY date DESC LIMIT ?',
            [videoRow.vid_preacher, id, limit]
        );

        const recommendations = rows.map(decorateVideoResponse);

        res.json(recommendations);
    } catch (error) {
        console.error('Error fetching recommendations:', error);
        res.status(500).json({ error: 'Failed to fetch recommendations' });
    }
});

/**
 * GET /api/videos/:id/video
 * Proxy video stream through backend for consistent access & CORS
 */
router.get('/:id/video', async (req, res) => {
    try {
        const video = await fetchVideoById(req.params.id);

        if (!video) {
            return res.status(404).json({ error: 'Video not found' });
        }

        const remoteUrl = videoProvider.getUrl(video.vid_url);
        const filename = getFilenameFromUrl(video.vid_url, `video_${video.id}.mp4`);
        return proxyMediaResponse(remoteUrl, req, res, { contentType: 'video/mp4', filename });
    } catch (error) {
        console.error('Error proxying video stream:', error);
        return res.status(500).json({ error: 'Failed to stream video' });
    }
});

/**
 * GET /api/videos/:id/audio
 * Provide audio-only stream (falls back to video source when separate audio missing)
 */
router.get('/:id/audio', async (req, res) => {
    try {
        const video = await fetchVideoById(req.params.id);

        if (!video) {
            return res.status(404).json({ error: 'Video not found' });
        }

        const remoteUrl = getAudioSource(video);
        const audioSource = video.audio_url || video.audio || swapExtension(video.vid_url, '.mp3');
        const filename = getFilenameFromUrl(audioSource, `audio_${video.id}.mp3`);
        return proxyMediaResponse([remoteUrl, videoProvider.getUrl(video.vid_url)], req, res, { contentType: 'audio/mpeg', filename });
    } catch (error) {
        console.error('Error proxying audio stream:', error);
        return res.status(500).json({ error: 'Failed to stream audio' });
    }
});

/**
 * GET /api/videos/:id/thumbnail
 * Proxy thumbnail image for CDNs that require backend access
 */
router.get('/:id/thumbnail', async (req, res) => {
    try {
        const video = await fetchVideoById(req.params.id);

        if (!video) {
            return res.status(404).json({ error: 'Video not found' });
        }

        const remoteUrl = getThumbnailSource(video);
        return proxyMediaResponse(remoteUrl, req, res, { contentType: 'image/jpeg' });
    } catch (error) {
        console.error('Error proxying thumbnail:', error);
        return res.status(500).json({ error: 'Failed to fetch thumbnail' });
    }
});

/**
 * GET /api/videos/:id/subtitles
 * Proxy WebVTT captions stored next to the source file
 */
router.get('/:id/subtitles', async (req, res) => {
    try {
        const video = await fetchVideoById(req.params.id);

        if (!video) {
            return res.status(404).json({ error: 'Video not found' });
        }

        const remoteUrl = getSubtitleSource(video);
        const subtitleSource = video.subtitles_url || video.subtitle_url || swapExtension(video.vid_url, '.vtt');
        const filename = getFilenameFromUrl(subtitleSource, `transcript_${video.id}.vtt`);
        return proxyMediaResponse(remoteUrl, req, res, { contentType: 'text/vtt; charset=utf-8', filename });
    } catch (error) {
        console.error('Error proxying subtitles:', error);
        return res.status(500).json({ error: 'Failed to fetch subtitles' });
    }
});

module.exports = router;

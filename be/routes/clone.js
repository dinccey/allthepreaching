/**
 * Clone/Mirror API routes
 * Provide DB and file cloning for mirror instances
 * Secured with API keys
 */
const express = require('express');
const router = express.Router();
const pool = require('../db');

const parseLimit = (value, fallback = 100, max = 500) => {
    const parsed = parseInt(value, 10);
    if (Number.isNaN(parsed) || parsed <= 0) {
        return fallback;
    }
    return Math.min(parsed, max);
};

/**
 * Middleware to verify API key
 */
function requireApiKey(req, res, next) {
    const apiKey = req.headers['x-api-key'];
    const validKey = process.env.API_CLONE_KEY;

    if (!validKey) {
        return res.status(503).json({ error: 'Clone API not configured' });
    }

    if (!apiKey || apiKey !== validKey) {
        return res.status(401).json({ error: 'Invalid or missing API key' });
    }

    next();
}

/**
 * GET /api/clone/db
 * Export database as JSON
 * Query params: since (optional date for incremental sync)
 */
router.get('/db', requireApiKey, async (req, res) => {
    try {
        const { since } = req.query;

        let query = 'SELECT * FROM videos';
        const params = [];

        if (since) {
            query += ' WHERE created_at >= ?';
            params.push(since);
        }

        query += ' ORDER BY id';

        const [videos] = await pool.query(query, params);

        res.json({
            timestamp: new Date().toISOString(),
            count: videos.length,
            videos
        });
    } catch (error) {
        console.error('Error exporting database:', error);
        res.status(500).json({ error: 'Failed to export database' });
    }
});

/**
 * GET /api/clone/files
 * List video files for mirroring
 * Returns metadata about files to be downloaded
 */
router.get('/files', requireApiKey, async (req, res) => {
    try {
        const { since, limit = 100 } = req.query;
        const { createVideoProvider } = require('../providers/VideoProvider');
        const videoProvider = createVideoProvider();

        let query = 'SELECT id, vid_url, thumb_url, vid_title, date FROM videos';
        const params = [];

        if (since) {
            query += ' WHERE date >= ?';
            params.push(since);
        }

        query += ' ORDER BY date DESC LIMIT ?';
        params.push(parseLimit(limit, 100, 500));

        const [videos] = await pool.query(query, params);

        const files = videos.map(video => ({
            id: video.id,
            title: video.vid_title,
            date: video.date,
            videoUrl: videoProvider.getUrl(video.vid_url),
            thumbUrl: video.thumb_url || videoProvider.getThumbnailUrl(video.vid_url),
            relativePath: video.vid_url
        }));

        res.json({
            timestamp: new Date().toISOString(),
            count: files.length,
            files
        });
    } catch (error) {
        console.error('Error listing files:', error);
        res.status(500).json({ error: 'Failed to list files' });
    }
});

/**
 * GET /api/clone/status
 * Get sync status information
 */
router.get('/status', requireApiKey, async (req, res) => {
    try {
        const [[{ total }]] = await pool.query('SELECT COUNT(*) as total FROM videos');
        const [[latest]] = await pool.query('SELECT date FROM videos ORDER BY date DESC LIMIT 1');

        res.json({
            totalVideos: total,
            latestVideo: latest?.date,
            serverTime: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error getting clone status:', error);
        res.status(500).json({ error: 'Failed to get status' });
    }
});

module.exports = router;

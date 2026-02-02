/**
 * Search proxy routes
 * Proxy requests to separate search service
 */
const express = require('express');
const router = express.Router();

/**
 * GET /api/search
 * Proxy search requests to search microservice
 * Query params: q (query), limit, offset
 */
router.get('/', async (req, res) => {
    try {
        const { q, limit = 20, offset = 0 } = req.query;

        if (!q) {
            return res.status(400).json({ error: 'Query parameter "q" is required' });
        }

        const searchUrl = process.env.SEARCH_SERVICE_URL;

        if (!searchUrl) {
            // Fallback to simple DB search if search service not configured
            const pool = require('../db');
            const [results] = await pool.query(
                `SELECT * FROM videos 
         WHERE vid_title LIKE ? OR vid_preacher LIKE ? OR name LIKE ?
         ORDER BY date DESC
         LIMIT ? OFFSET ?`,
                [`%${q}%`, `%${q}%`, `%${q}%`, parseInt(limit), parseInt(offset)]
            );

            const { createVideoProvider } = require('../providers/VideoProvider');
            const videoProvider = createVideoProvider();

            const videos = results.map(video => ({
                ...video,
                vid_url: videoProvider.getUrl(video.vid_url),
                thumb_url: video.thumb_url || videoProvider.getThumbnailUrl(video.vid_url)
            }));

            return res.json({
                results: videos,
                total: videos.length,
                query: q
            });
        }

        // Proxy to search service
        const fetch = require('node-fetch');
        const response = await fetch(
            `${searchUrl}/search?q=${encodeURIComponent(q)}&limit=${limit}&offset=${offset}`
        );

        if (!response.ok) {
            throw new Error(`Search service returned ${response.status}`);
        }

        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Error searching videos:', error);
        res.status(500).json({ error: 'Search failed' });
    }
});

module.exports = router;

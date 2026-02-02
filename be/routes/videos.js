/**
 * Video routes
 * Handle video listing, filtering, and metadata retrieval
 */
const express = require('express');
const router = express.Router();
const pool = require('../db');
const { createVideoProvider } = require('../providers/VideoProvider');

const videoProvider = createVideoProvider();

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
            page = 1,
            limit = 20,
            sort = 'date'
        } = req.query;

        const offset = (parseInt(page) - 1) * parseInt(limit);

        // Build dynamic query
        let query = 'SELECT * FROM videos WHERE 1=1';
        const params = [];

        if (preacher) {
            query += ' AND vid_preacher = ?';
            params.push(preacher);
        }

        if (category) {
            query += ' AND vid_category = ?';
            params.push(category);
        }

        if (search_category) {
            query += ' AND search_category = ?';
            params.push(search_category);
        }

        // Add sorting
        const sortColumn = sort === 'views' ? 'clicks' : 'date';
        query += ` ORDER BY ${sortColumn} DESC`;

        // Add pagination
        query += ' LIMIT ? OFFSET ?';
        params.push(parseInt(limit), offset);

        const [rows] = await pool.query(query, params);

        // Enhance rows with provider URLs
        const videos = rows.map(video => ({
            ...video,
            vid_url: videoProvider.getUrl(video.vid_url),
            thumb_url: video.thumb_url || videoProvider.getThumbnailUrl(video.vid_url)
        }));

        // Get total count for pagination
        let countQuery = 'SELECT COUNT(*) as total FROM videos WHERE 1=1';
        const countParams = [];

        if (preacher) {
            countQuery += ' AND vid_preacher = ?';
            countParams.push(preacher);
        }
        if (category) {
            countQuery += ' AND vid_category = ?';
            countParams.push(category);
        }
        if (search_category) {
            countQuery += ' AND search_category = ?';
            countParams.push(search_category);
        }

        const [[{ total }]] = await pool.query(countQuery, countParams);

        res.json({
            videos,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                totalPages: Math.ceil(total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('Error fetching videos:', error);
        res.status(500).json({ error: 'Failed to fetch videos' });
    }
});

/**
 * GET /api/videos/:id
 * Get single video by ID with full metadata
 */
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const [rows] = await pool.query('SELECT * FROM videos WHERE id = ?', [id]);

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Video not found' });
        }

        const video = {
            ...rows[0],
            vid_url: videoProvider.getUrl(rows[0].vid_url),
            thumb_url: rows[0].thumb_url || videoProvider.getThumbnailUrl(rows[0].vid_url)
        };

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
        const [[video]] = await pool.query('SELECT vid_preacher FROM videos WHERE id = ?', [id]);

        if (!video) {
            return res.status(404).json({ error: 'Video not found' });
        }

        // Get other videos from same preacher
        const [rows] = await pool.query(
            'SELECT * FROM videos WHERE vid_preacher = ? AND id != ? ORDER BY date DESC LIMIT ?',
            [video.vid_preacher, id, limit]
        );

        const recommendations = rows.map(v => ({
            ...v,
            vid_url: videoProvider.getUrl(v.vid_url),
            thumb_url: v.thumb_url || videoProvider.getThumbnailUrl(v.vid_url)
        }));

        res.json(recommendations);
    } catch (error) {
        console.error('Error fetching recommendations:', error);
        res.status(500).json({ error: 'Failed to fetch recommendations' });
    }
});

module.exports = router;

/**
 * Preacher routes
 * Handle preacher listing and metadata
 */
const express = require('express');
const router = express.Router();
const pool = require('../db');

/**
 * GET /api/preachers
 * List all preachers with video counts
 */
router.get('/', async (req, res) => {
    try {
        const [preachers] = await pool.query(`
      SELECT 
        vid_preacher as name,
        COUNT(*) as videoCount,
        MAX(date) as latestVideo
      FROM videos
      GROUP BY vid_preacher
      ORDER BY vid_preacher
    `);

        res.json(preachers);
    } catch (error) {
        console.error('Error fetching preachers:', error);
        res.status(500).json({ error: 'Failed to fetch preachers' });
    }
});

/**
 * GET /api/preachers/:slug
 * Get preacher info and stats
 */
router.get('/:slug', async (req, res) => {
    try {
        const { slug } = req.params;

        const [[stats]] = await pool.query(`
      SELECT 
        vid_preacher as name,
        COUNT(*) as videoCount,
        MAX(date) as latestVideo,
        MIN(date) as firstVideo,
        SUM(clicks) as totalViews
      FROM videos
      WHERE vid_preacher = ?
      GROUP BY vid_preacher
    `, [slug]);

        if (!stats) {
            return res.status(404).json({ error: 'Preacher not found' });
        }

        res.json(stats);
    } catch (error) {
        console.error('Error fetching preacher:', error);
        res.status(500).json({ error: 'Failed to fetch preacher' });
    }
});

module.exports = router;

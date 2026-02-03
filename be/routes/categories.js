/**
 * Categories routes
 * Handles category listing and autocomplete
 */
const express = require('express');
const router = express.Router();
const db = require('../db');

const parseLimit = (value, fallback = 20, max = 200) => {
    const parsed = parseInt(value, 10);
    if (Number.isNaN(parsed) || parsed <= 0) {
        return fallback;
    }
    return Math.min(parsed, max);
};

const parsePage = (value, fallback = 1) => {
    const parsed = parseInt(value, 10);
    if (Number.isNaN(parsed) || parsed <= 0) {
        return fallback;
    }
    return parsed;
};

/**
 * GET /api/categories
 * Get all categories with video counts
 * Query params: q (search query for autocomplete)
 */
router.get('/', async (req, res) => {
    try {
        const { q } = req.query;

        const baseQuery = `
            SELECT 
                vid_category AS slug,
                COALESCE(NULLIF(MAX(search_category), ''), vid_category) AS name,
                COUNT(*) AS videoCount
            FROM videos
            WHERE vid_category IS NOT NULL
            GROUP BY vid_category
        `;

        let query = `SELECT * FROM (${baseQuery}) AS categories`;

        const params = [];

        // Add search filter for autocomplete
        if (q) {
            query += ' WHERE name LIKE ?';
            params.push(`%${q}%`);
        }

        query += ' ORDER BY videoCount DESC';

        const [categories] = await db.query(query, params);

        res.json(categories);
    } catch (error) {
        console.error('Error fetching categories:', error);
        res.status(500).json({ error: 'Failed to fetch categories' });
    }
});

/**
 * GET /api/categories/:name
 * Get category details and videos
 */
router.get('/:name', async (req, res) => {
    try {
        const { name } = req.params;
        const page = parsePage(req.query.page, 1);
        const limit = parseLimit(req.query.limit, 20, 200);
        const offset = (page - 1) * limit;

        // Get videos for this category
        const [videos] = await db.query(
            `SELECT * FROM videos 
             WHERE vid_category = ?
             ORDER BY date DESC
             LIMIT ? OFFSET ?`,
            [name, limit, offset]
        );

        // Get total count
        const [[{ total }]] = await db.query(
            'SELECT COUNT(*) as total FROM videos WHERE vid_category = ?',
            [name]
        );

        res.json({
            category: name,
            videos,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error('Error fetching category:', error);
        res.status(500).json({ error: 'Failed to fetch category' });
    }
});

module.exports = router;

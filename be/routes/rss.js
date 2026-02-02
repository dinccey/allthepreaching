/**
 * RSS feed generation routes
 * Generate RSS feeds for videos by category, preacher, date
 */
const express = require('express');
const router = express.Router();
const RSS = require('rss');
const pool = require('../db');
const { createVideoProvider } = require('../providers/VideoProvider');

const videoProvider = createVideoProvider();

/**
 * GET /api/rss
 * Generate RSS feed with filters
 * Query params: category, preacher, since, limit
 */
router.get('/', async (req, res) => {
    try {
        const {
            category,
            preacher,
            since,
            limit = 50
        } = req.query;

        // Build query
        let query = 'SELECT * FROM videos WHERE 1=1';
        const params = [];

        if (category) {
            query += ' AND vid_category = ?';
            params.push(category);
        }

        if (preacher) {
            query += ' AND vid_preacher = ?';
            params.push(preacher);
        }

        if (since) {
            query += ' AND date >= ?';
            params.push(since);
        }

        query += ' ORDER BY date DESC LIMIT ?';
        params.push(parseInt(limit));

        const [videos] = await pool.query(query, params);

        // Create RSS feed
        const feed = new RSS({
            title: 'ALLthePREACHING.com',
            description: 'KJV-only Independent Fundamental Baptist Preaching',
            feed_url: `https://allthepreaching.com/api/rss${req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : ''}`,
            site_url: 'https://allthepreaching.com',
            image_url: 'https://allthepreaching.com/logo.png',
            language: 'en',
            categories: category ? [category] : ['Preaching', 'Baptist', 'KJV'],
            pubDate: new Date(),
            ttl: 60
        });

        // Add items
        videos.forEach(video => {
            const mediaUrl = videoProvider.getUrl(video.vid_url);
            feed.item({
                title: video.vid_title || video.name,
                description: `Sermon by ${video.vid_preacher}`,
                url: `https://allthepreaching.com/video/${video.id}`,
                guid: video.id.toString(),
                categories: [video.vid_category, video.search_category].filter(Boolean),
                author: video.vid_preacher,
                date: new Date(video.date),
                enclosure: {
                    url: mediaUrl,
                    type: 'video/mp4'
                },
                custom_elements: [
                    { 'itunes:duration': video.runtime_minutes ? Math.round(video.runtime_minutes * 60) : undefined },
                    { 'itunes:author': video.vid_preacher },
                    { 'media:content': { _attr: { url: mediaUrl, type: 'video/mp4', medium: 'video' } } }
                ]
            });
        });

        res.type('application/rss+xml');
        res.send(feed.xml());
    } catch (error) {
        console.error('Error generating RSS feed:', error);
        res.status(500).json({ error: 'Failed to generate RSS feed' });
    }
});

/**
 * GET /api/rss/preacher/:slug
 * Generate RSS feed for specific preacher
 */
router.get('/preacher/:slug', async (req, res) => {
    try {
        const { slug } = req.params;
        const limit = parseInt(req.query.limit) || 50;

        const [videos] = await pool.query(
            'SELECT * FROM videos WHERE vid_preacher = ? ORDER BY date DESC LIMIT ?',
            [slug, limit]
        );

        const feed = new RSS({
            title: `${slug} - ALLthePREACHING.com`,
            description: `Sermons by ${slug}`,
            feed_url: `https://allthepreaching.com/api/rss/preacher/${slug}`,
            site_url: `https://allthepreaching.com/preacher/${slug}`,
            language: 'en',
            pubDate: new Date(),
            ttl: 60
        });

        videos.forEach(video => {
            const mediaUrl = videoProvider.getUrl(video.vid_url);
            feed.item({
                title: video.vid_title || video.name,
                description: `Sermon by ${video.vid_preacher}`,
                url: `https://allthepreaching.com/video/${video.id}`,
                guid: video.id.toString(),
                date: new Date(video.date),
                enclosure: {
                    url: mediaUrl,
                    type: 'video/mp4'
                },
                custom_elements: [
                    { 'itunes:duration': video.runtime_minutes ? Math.round(video.runtime_minutes * 60) : undefined },
                    { 'itunes:author': video.vid_preacher },
                    { 'media:content': { _attr: { url: mediaUrl, type: 'video/mp4', medium: 'video' } } }
                ]
            });
        });

        res.type('application/rss+xml');
        res.send(feed.xml());
    } catch (error) {
        console.error('Error generating preacher RSS feed:', error);
        res.status(500).json({ error: 'Failed to generate RSS feed' });
    }
});

module.exports = router;

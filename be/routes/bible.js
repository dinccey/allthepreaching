const express = require('express');
const bibleService = require('../services/bibleService');

const router = express.Router();

router.get('/languages', async (req, res) => {
    try {
        const languages = await bibleService.getLanguages();
        res.json(languages);
    } catch (error) {
        console.error('Error fetching Bible languages:', error);
        res.status(500).json({ error: 'Failed to fetch Bible languages' });
    }
});

router.get('/:language/meta', async (req, res) => {
    try {
        const meta = await bibleService.getMeta(req.params.language);
        res.json(meta);
    } catch (error) {
        console.error('Error fetching Bible metadata:', error);
        res.status(404).json({ error: 'Bible metadata not found' });
    }
});

router.get('/:language/books/:bookId/chapters/:chapter', async (req, res) => {
    try {
        const chapter = await bibleService.getChapter(req.params.language, req.params.bookId, req.params.chapter);
        res.json(chapter);
    } catch (error) {
        console.error('Error fetching Bible chapter:', error);
        const status = error.message === 'Invalid chapter' ? 400 : 404;
        res.status(status).json({ error: 'Bible chapter not found' });
    }
});

module.exports = router;
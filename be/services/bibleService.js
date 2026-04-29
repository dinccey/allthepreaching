const fs = require('fs/promises');
const path = require('path');
const config = require('../config');
const { createVideoProvider } = require('../providers/VideoProvider');

const dataRoot = path.join(__dirname, '..', 'data', 'bible');
const videoProvider = createVideoProvider();
const indexCache = new Map();
const chapterCache = new Map();
const chapterCacheOrder = [];
const maxChapterCacheEntries = Math.max(parseInt(process.env.BIBLE_CACHE_MAX_CHAPTERS || '64', 10), 8);

function getLanguageRoot(language) {
    return path.join(dataRoot, language);
}

function touchChapterCache(key) {
    const existingIndex = chapterCacheOrder.indexOf(key);
    if (existingIndex >= 0) {
        chapterCacheOrder.splice(existingIndex, 1);
    }
    chapterCacheOrder.push(key);

    while (chapterCacheOrder.length > maxChapterCacheEntries) {
        const evictedKey = chapterCacheOrder.shift();
        if (evictedKey) {
            chapterCache.delete(evictedKey);
        }
    }
}

async function readJson(filePath) {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
}

async function getIndex(language = 'en') {
    if (indexCache.has(language)) {
        return indexCache.get(language);
    }

    const index = await readJson(path.join(getLanguageRoot(language), 'index.json'));
    indexCache.set(language, index);
    return index;
}

function resolveMediaPath(mediaPath, language = 'en') {
    if (!mediaPath) {
        return null;
    }

    const languageBaseUrl = config.bible.audioBaseUrls?.[language] || config.bible.audioBaseUrl;
    if (languageBaseUrl) {
        const baseUrl = languageBaseUrl.replace(/\/+$/, '');
        const cleanPath = mediaPath
            .replace(/^\/+/, '')
            .replace(/^Waggoner_verses\//, '');
        return `${baseUrl}/${cleanPath}`;
    }

    return videoProvider.getUrl(mediaPath);
}

function hydrateChapterPayload(payload) {
    const language = payload.language || 'en';
    return {
        ...payload,
        audio: {
            bookIntro: {
                ...payload.audio.bookIntro,
                path: resolveMediaPath(payload.audio.bookIntro.path, language),
            },
            chapterIntro: {
                ...payload.audio.chapterIntro,
                path: resolveMediaPath(payload.audio.chapterIntro.path, language),
            },
        },
        verses: payload.verses.map((verse) => ({
            ...verse,
            audioPath: resolveMediaPath(verse.audioPath, language),
        })),
    };
}

async function getLanguages() {
    const index = await getIndex('en');
    return [{
        id: 'en',
        label: index.label,
        translationLabel: index.translationLabel,
        hasText: true,
        hasAudio: index.books.some((book) => book.hasAudio),
        isDefault: true,
    }];
}

async function getMeta(language = 'en') {
    return getIndex(language);
}

async function getChapter(language = 'en', bookId, chapter) {
    const chapterNumber = parseInt(chapter, 10);
    if (Number.isNaN(chapterNumber) || chapterNumber <= 0) {
        throw new Error('Invalid chapter');
    }

    const cacheKey = `${language}:${bookId}:${chapterNumber}`;
    if (chapterCache.has(cacheKey)) {
        touchChapterCache(cacheKey);
        return hydrateChapterPayload(chapterCache.get(cacheKey));
    }

    const chapterPath = path.join(getLanguageRoot(language), 'books', bookId, 'chapters', `${chapterNumber}.json`);
    const payload = await readJson(chapterPath);
    chapterCache.set(cacheKey, payload);
    touchChapterCache(cacheKey);
    return hydrateChapterPayload(payload);
}

module.exports = {
    getLanguages,
    getMeta,
    getChapter,
};
const fs = require('fs/promises');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..', '..', '..');
const bibleDataRoot = path.join(projectRoot, 'be', 'data', 'bible');

async function readJson(filePath) {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
}

function toAbsoluteMediaPath(mediaPath) {
    if (!mediaPath) {
        return null;
    }

    return path.join(projectRoot, mediaPath);
}

async function loadChapter({ language = 'en', bookId, chapter }) {
    const chapterNumber = parseInt(chapter, 10);
    if (!bookId) {
        throw new Error('Missing bookId');
    }
    if (Number.isNaN(chapterNumber) || chapterNumber <= 0) {
        throw new Error('Invalid chapter');
    }

    const chapterPath = path.join(bibleDataRoot, language, 'books', bookId, 'chapters', `${chapterNumber}.json`);
    const payload = await readJson(chapterPath);

    return {
        ...payload,
        absolutePaths: {
            bookIntro: toAbsoluteMediaPath(payload.audio?.bookIntro?.path),
            chapterIntro: toAbsoluteMediaPath(payload.audio?.chapterIntro?.path),
        },
        verses: payload.verses.map((verse) => ({
            ...verse,
            absoluteAudioPath: toAbsoluteMediaPath(verse.audioPath),
        })),
    };
}

module.exports = {
    loadChapter,
};
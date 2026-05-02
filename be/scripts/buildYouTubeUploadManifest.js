const fs = require('fs/promises');
const path = require('path');
const { parseArgs } = require('./renderScriptureVideo');
const { getCodecProfile } = require('../services/scriptureVideo/codecProfiles');

const projectRoot = path.resolve(__dirname, '..', '..');
const bibleDataRoot = path.join(projectRoot, 'be', 'data', 'bible');
const scriptureVideoRoot = path.join(projectRoot, 'be', 'data', 'scripture-video');

async function readJson(filePath) {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
}

async function fileExists(filePath) {
    try {
        await fs.access(filePath);
        return true;
    } catch {
        return false;
    }
}

function csvEscape(value) {
    const text = String(value ?? '');
    if (/[",\n]/.test(text)) {
        return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
}

function buildChapterQueue(index) {
    return index.books
        .filter((book) => book.hasAudio)
        .sort((left, right) => left.bookIndex - right.bookIndex)
        .flatMap((book) => Array.from({ length: book.chapterCount }, (_, chapterIndex) => ({
            bookId: book.bookId,
            bookName: book.name,
            bookIndex: book.bookIndex,
            chapter: chapterIndex + 1,
        })));
}

function buildOutputBaseName(bookId, chapter, profileId) {
    const baseName = `${bookId}-${String(chapter).padStart(3, '0')}`;
    return profileId === 'social' ? baseName : `${baseName}.${profileId}`;
}

function buildTitle(entry, translationLabel) {
    return `${entry.bookName} ${entry.chapter} | ${translationLabel} Audio Bible`;
}

function buildDescription(entry, translationLabel) {
    return [
        `${entry.bookName} ${entry.chapter} from the ${translationLabel} Bible with synced subtitles.`,
        '',
        `Book: ${entry.bookName}`,
        `Chapter: ${entry.chapter}`,
        `Translation: ${translationLabel}`,
        'Language: English',
        '',
        'This upload was generated from the ALLthePREACHING scripture video pipeline.',
    ].join('\n');
}

function buildTags(entry, translationLabel) {
    return Array.from(new Set([
        translationLabel,
        'KJV',
        'Bible',
        'Audio Bible',
        'Scripture Reading',
        entry.bookName,
        `${entry.bookName} ${entry.chapter}`,
    ]));
}

function parseChapterList(rawValue) {
    if (!rawValue) {
        return null;
    }

    const chapters = rawValue
        .split(',')
        .map((value) => parseInt(value.trim(), 10))
        .filter((value) => !Number.isNaN(value) && value > 0);

    return chapters.length > 0 ? new Set(chapters) : null;
}

function applyFilters(queue, args) {
    const chapterSet = parseChapterList(args.chapters);
    const startChapter = args.startChapter ? parseInt(args.startChapter, 10) : null;
    const endChapter = args.endChapter ? parseInt(args.endChapter, 10) : null;

    return queue.filter((entry) => {
        if (args.book && entry.bookId !== args.book) {
            return false;
        }
        if (chapterSet && !chapterSet.has(entry.chapter)) {
            return false;
        }
        if (startChapter !== null && entry.chapter < startChapter) {
            return false;
        }
        if (endChapter !== null && entry.chapter > endChapter) {
            return false;
        }
        return true;
    });
}

async function generateManifest({
    language = 'en',
    profile = 'gpu',
    privacyStatus = 'private',
    categoryId = '27',
    limit = null,
    onlyExisting = true,
    book = null,
    chapters = null,
    startChapter = null,
    endChapter = null,
}) {
    const codecProfile = getCodecProfile(profile);
    const index = await readJson(path.join(bibleDataRoot, language, 'index.json'));
    const queue = applyFilters(buildChapterQueue(index), {
        book,
        chapters,
        startChapter,
        endChapter,
    });
    const cappedQueue = limit && limit > 0 ? queue.slice(0, limit) : queue;
    const uploadEntries = [];

    for (const entry of cappedQueue) {
        const outputBaseName = buildOutputBaseName(entry.bookId, entry.chapter, codecProfile.id);
        const videoPath = path.join(scriptureVideoRoot, 'output', language, entry.bookId, `${outputBaseName}.${codecProfile.containerExtension}`);
        const subtitlePath = path.join(scriptureVideoRoot, 'output', language, entry.bookId, `${outputBaseName}.srt`);
        const videoExists = await fileExists(videoPath);
        const subtitleExists = await fileExists(subtitlePath);

        if (onlyExisting && !videoExists) {
            continue;
        }

        uploadEntries.push({
            order: uploadEntries.length + 1,
            language,
            profile: codecProfile.id,
            bookId: entry.bookId,
            bookName: entry.bookName,
            chapter: entry.chapter,
            title: buildTitle(entry, index.translationLabel),
            description: buildDescription(entry, index.translationLabel),
            tags: buildTags(entry, index.translationLabel),
            categoryId,
            privacyStatus,
            videoPath,
            videoExists,
            subtitlePath,
            subtitleExists,
            subtitleLanguage: language,
            playlistName: `${entry.bookName} ${index.translationLabel}`,
        });
    }

    const manifestDir = path.join(scriptureVideoRoot, 'upload', 'youtube', language);
    const manifestBaseName = `manifest.${codecProfile.id}`;
    const jsonPath = path.join(manifestDir, `${manifestBaseName}.json`);
    const csvPath = path.join(manifestDir, `${manifestBaseName}.csv`);

    await fs.mkdir(manifestDir, { recursive: true });
    await fs.writeFile(jsonPath, `${JSON.stringify({
        generatedAt: new Date().toISOString(),
        language,
        translationLabel: index.translationLabel,
        profile: codecProfile.id,
        privacyStatus,
        categoryId,
        supportsTrueBatchUpload: false,
        uploadStrategy: 'sequential videos.insert followed by captions.insert per video',
        filters: {
            book,
            chapters,
            startChapter,
            endChapter,
        },
        entries: uploadEntries,
    }, null, 2)}\n`);

    const csvRows = [
        ['order', 'title', 'description', 'privacyStatus', 'categoryId', 'tags', 'videoPath', 'videoExists', 'subtitlePath', 'subtitleExists', 'subtitleLanguage', 'playlistName'].join(','),
        ...uploadEntries.map((entry) => ([
            entry.order,
            csvEscape(entry.title),
            csvEscape(entry.description),
            entry.privacyStatus,
            entry.categoryId,
            csvEscape(entry.tags.join('|')),
            csvEscape(entry.videoPath),
            entry.videoExists,
            csvEscape(entry.subtitlePath),
            entry.subtitleExists,
            entry.subtitleLanguage,
            csvEscape(entry.playlistName),
        ].join(','))),
    ];
    await fs.writeFile(csvPath, `${csvRows.join('\n')}\n`);

    return {
        jsonPath,
        csvPath,
        profile: codecProfile.id,
        entryCount: uploadEntries.length,
        uploadStrategy: 'sequential videos.insert then captions.insert',
    };
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const result = await generateManifest({
        language: args.language || 'en',
        profile: args.profile || 'gpu',
        privacyStatus: args.privacyStatus || 'private',
        categoryId: args.categoryId || '27',
        limit: args.limit ? parseInt(args.limit, 10) : null,
        onlyExisting: args.onlyExisting !== '0',
        book: args.book || null,
        chapters: args.chapters || null,
        startChapter: args.startChapter || null,
        endChapter: args.endChapter || null,
    });

    console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) {
    main().catch((error) => {
        console.error(error.stack || error.message);
        process.exit(1);
    });
}

module.exports = {
    generateManifest,
};
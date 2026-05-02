const fs = require('fs/promises');
const path = require('path');
const { parseArgs } = require('./renderScriptureVideo');
const { getCodecProfile } = require('../services/scriptureVideo/codecProfiles');
const { writeYouTubeSubtitles } = require('../services/scriptureVideo/youtubeSubtitleRenderer');

const projectRoot = path.resolve(__dirname, '..', '..');
const bibleDataRoot = path.join(projectRoot, 'be', 'data', 'bible');
const scriptureVideoRoot = path.join(projectRoot, 'be', 'data', 'scripture-video');

async function readJson(filePath) {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
}

async function writeJson(filePath, value) {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

async function loadBibleIndex(language) {
    return readJson(path.join(bibleDataRoot, language, 'index.json'));
}

function buildChapterQueue(index) {
    return index.books
        .filter((book) => book.hasAudio)
        .sort((left, right) => left.bookIndex - right.bookIndex)
        .flatMap((book) => Array.from({ length: book.chapterCount }, (_, chapterIndex) => ({
            bookId: book.bookId,
            bookName: book.name,
            chapter: chapterIndex + 1,
        })));
}

async function loadProgress(progressPath) {
    try {
        return await readJson(progressPath);
    } catch (error) {
        if (error.code === 'ENOENT') {
            return null;
        }
        throw error;
    }
}

function findResumeIndex(queue, progress) {
    if (!progress?.lastCompleted) {
        return 0;
    }

    const index = queue.findIndex((entry) => (
        entry.bookId === progress.lastCompleted.bookId &&
        entry.chapter === progress.lastCompleted.chapter
    ));

    return index >= 0 ? index : 0;
}

async function renderChapterYouTubeSubtitles({ language = 'en', bookId, chapter, profile = 'gpu' }) {
    const codecProfile = getCodecProfile(profile);
    const baseName = `${bookId}-${String(chapter).padStart(3, '0')}`;
    const outputBaseName = codecProfile.id === 'social' ? baseName : `${baseName}.${codecProfile.id}`;
    const manifestPath = path.join(scriptureVideoRoot, 'manifests', language, bookId, `${baseName}.json`);
    const subtitleOutputPath = path.join(scriptureVideoRoot, 'output', language, bookId, `${outputBaseName}.srt`);
    const manifest = await readJson(manifestPath);

    await writeYouTubeSubtitles({
        manifest,
        outputPath: subtitleOutputPath,
    });

    return {
        manifestPath,
        subtitleOutputPath,
    };
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const language = args.language || 'en';
    const profile = args.profile || 'gpu';
    const limit = args.limit ? parseInt(args.limit, 10) : null;
    const progressPath = args.progressFile
        ? path.resolve(process.cwd(), args.progressFile)
        : path.join(scriptureVideoRoot, 'progress', `subtitles-${language}-${profile}.json`);

    if (limit !== null && (Number.isNaN(limit) || limit <= 0)) {
        throw new Error('Invalid --limit value');
    }

    const index = await loadBibleIndex(language);
    const queue = buildChapterQueue(index);
    const existingProgress = await loadProgress(progressPath);
    const startIndex = findResumeIndex(queue, existingProgress);
    const queueEnd = limit === null ? queue.length : Math.min(queue.length, startIndex + limit);
    const activeQueue = queue.slice(startIndex, queueEnd);

    if (activeQueue.length === 0) {
        console.log(JSON.stringify({ message: 'No chapter subtitles left to generate.', progressPath }, null, 2));
        return;
    }

    await writeJson(progressPath, {
        language,
        profile,
        startedAt: new Date().toISOString(),
        totalChapters: queue.length,
        lastCompleted: existingProgress?.lastCompleted || null,
        nextPlanned: activeQueue[0],
        status: 'running',
    });

    let completedCount = startIndex;
    let lastResult = null;

    for (const entry of activeQueue) {
        console.log(`Generating subtitles for ${entry.bookName} ${entry.chapter} (${completedCount + 1}/${queue.length})`);
        lastResult = await renderChapterYouTubeSubtitles({
            language,
            bookId: entry.bookId,
            chapter: entry.chapter,
            profile,
        });
        completedCount += 1;

        await writeJson(progressPath, {
            language,
            profile,
            startedAt: existingProgress?.startedAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            totalChapters: queue.length,
            completedCount,
            lastCompleted: {
                bookId: entry.bookId,
                chapter: entry.chapter,
            },
            nextPlanned: queue[completedCount] || null,
            status: completedCount >= queue.length ? 'completed' : 'running',
            lastSubtitlePath: lastResult.subtitleOutputPath,
        });
    }

    console.log(JSON.stringify({
        progressPath,
        profile,
        resumedFrom: existingProgress?.lastCompleted || null,
        generatedCount: activeQueue.length,
        lastResult,
    }, null, 2));
}

main().catch((error) => {
    console.error(error.stack || error.message);
    process.exit(1);
});
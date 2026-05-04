const fs = require('fs/promises');
const path = require('path');
const { execFile } = require('child_process');
const { parseArgs } = require('./renderScriptureVideo');
const { getCodecProfile } = require('../services/scriptureVideo/codecProfiles');
const { buildYouTubeSubtitleBlocks, formatSrtTime } = require('../services/scriptureVideo/youtubeSubtitleRenderer');

const projectRoot = path.resolve(__dirname, '..', '..');
const bibleDataRoot = path.join(projectRoot, 'be', 'data', 'bible');
const scriptureVideoRoot = path.join(projectRoot, 'be', 'data', 'scripture-video');
const chapterOutputRoot = path.join(scriptureVideoRoot, 'output');
const bookOutputRoot = path.join(scriptureVideoRoot, 'output-books');
const manifestRoot = path.join(scriptureVideoRoot, 'manifests');

function execFileAsync(command, args, options = {}) {
    return new Promise((resolve, reject) => {
        execFile(command, args, { ...options, maxBuffer: 1024 * 1024 * 16 }, (error, stdout, stderr) => {
            if (error) {
                reject(new Error(stderr || error.message));
                return;
            }
            resolve({ stdout, stderr });
        });
    });
}

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

function buildBookQueue(index, requestedBookId = null) {
    return index.books
        .filter((book) => book.hasAudio)
        .filter((book) => !requestedBookId || book.bookId === requestedBookId)
        .sort((left, right) => left.bookIndex - right.bookIndex)
        .map((book) => ({
            bookId: book.bookId,
            bookName: book.name,
            bookIndex: book.bookIndex,
            chapterCount: book.chapterCount,
        }));
}

function findResumeIndex(queue, progress) {
    if (!progress?.lastCompleted?.bookId) {
        return 0;
    }

    const index = queue.findIndex((entry) => entry.bookId === progress.lastCompleted.bookId);
    return index >= 0 ? index + 1 : 0;
}

function buildChapterBaseName(bookId, chapterNumber) {
    return `${bookId}-${String(chapterNumber).padStart(3, '0')}`;
}

function buildOutputBaseName(bookId, profileId) {
    return profileId === 'social' ? bookId : `${bookId}.${profileId}`;
}

function buildChapterVideoPath({ language, bookId, chapterNumber, codecProfile }) {
    const baseName = buildChapterBaseName(bookId, chapterNumber);
    const outputBaseName = codecProfile.id === 'social' ? baseName : `${baseName}.${codecProfile.id}`;
    return path.join(chapterOutputRoot, language, bookId, `${outputBaseName}.${codecProfile.containerExtension}`);
}

function buildChapterManifestPath({ language, bookId, chapterNumber }) {
    const baseName = buildChapterBaseName(bookId, chapterNumber);
    return path.join(manifestRoot, language, bookId, `${baseName}.json`);
}

async function ensureAllChapterOutputsExist({ language, bookId, chapterCount, codecProfile }) {
    const chapterPaths = [];

    for (let chapterNumber = 1; chapterNumber <= chapterCount; chapterNumber += 1) {
        const chapterPath = buildChapterVideoPath({ language, bookId, chapterNumber, codecProfile });
        try {
            await fs.access(chapterPath);
        } catch {
            throw new Error(`Missing chapter output for ${bookId} ${chapterNumber}: ${chapterPath}`);
        }
        chapterPaths.push(chapterPath);
    }

    return chapterPaths;
}

async function loadChapterManifests({ language, bookId, chapterCount }) {
    const manifests = [];

    for (let chapterNumber = 1; chapterNumber <= chapterCount; chapterNumber += 1) {
        const manifestPath = buildChapterManifestPath({ language, bookId, chapterNumber });
        manifests.push(await readJson(manifestPath));
    }

    return manifests;
}

async function writeConcatList(filePaths, concatListPath) {
    const content = filePaths
        .map((filePath) => `file '${filePath.replace(/'/g, "'\\''")}'`)
        .join('\n');
    await fs.mkdir(path.dirname(concatListPath), { recursive: true });
    await fs.writeFile(concatListPath, `${content}\n`, 'utf8');
}

async function writeBookSubtitleAssets({ outputDir, outputBaseName, book, chapterManifests }) {
    const subtitleOutputPath = path.join(outputDir, `${outputBaseName}.srt`);
    const chapterTimestampsPath = path.join(outputDir, `${outputBaseName}.chapters.txt`);
    const blocks = [];
    const chapterTimestamps = [];
    let offsetMs = 0;
    let subtitleIndex = 1;

    for (const manifest of chapterManifests) {
        chapterTimestamps.push(`${formatSrtTime(offsetMs).replace(',', '.').slice(0, 8)} ${book.bookName} ${manifest.reference.chapter}`);
        const manifestBlocks = buildYouTubeSubtitleBlocks({
            manifest,
            offsetMs,
            startIndex: subtitleIndex,
        });
        blocks.push(...manifestBlocks);
        subtitleIndex += manifestBlocks.length;
        offsetMs += manifest.totalDurationMs;
    }

    await fs.mkdir(outputDir, { recursive: true });
    await fs.writeFile(subtitleOutputPath, `${blocks.join('\n')}\n`, 'utf8');
    await fs.writeFile(chapterTimestampsPath, `${chapterTimestamps.join('\n')}\n`, 'utf8');

    return {
        subtitleOutputPath,
        chapterTimestampsPath,
        chapterTimestamps,
    };
}

async function stitchBook({ language, book, codecProfile }) {
    const ffmpegBin = process.env.SCRIPTURE_VIDEO_FFMPEG_BIN || 'ffmpeg';
    const chapterPaths = await ensureAllChapterOutputsExist({
        language,
        bookId: book.bookId,
        chapterCount: book.chapterCount,
        codecProfile,
    });
    const chapterManifests = await loadChapterManifests({
        language,
        bookId: book.bookId,
        chapterCount: book.chapterCount,
    });
    const outputDir = path.join(bookOutputRoot, language, book.bookId);
    const outputBaseName = buildOutputBaseName(book.bookId, codecProfile.id);
    const concatListPath = path.join(outputDir, `${outputBaseName}.concat.txt`);
    const outputPath = path.join(outputDir, `${outputBaseName}.${codecProfile.containerExtension}`);
    const reportPath = path.join(outputDir, `${outputBaseName}.json`);

    await writeConcatList(chapterPaths, concatListPath);
    await fs.mkdir(outputDir, { recursive: true });

    await execFileAsync(ffmpegBin, [
        '-y',
        '-f', 'concat',
        '-safe', '0',
        '-i', concatListPath,
        '-c', 'copy',
        '-movflags', '+faststart',
        outputPath,
    ], { cwd: outputDir });

    const subtitleAssets = await writeBookSubtitleAssets({
        outputDir,
        outputBaseName,
        book,
        chapterManifests,
    });

    const report = {
        language,
        profile: codecProfile.id,
        stitchedAt: new Date().toISOString(),
        bookId: book.bookId,
        bookName: book.bookName,
        chapterCount: book.chapterCount,
        chapterPaths,
        outputPath,
        concatListPath,
        subtitlePath: subtitleAssets.subtitleOutputPath,
        chapterTimestampsPath: subtitleAssets.chapterTimestampsPath,
        chapterTimestamps: subtitleAssets.chapterTimestamps,
        mode: 'ffmpeg-concat-copy',
    };
    await writeJson(reportPath, report);

    return report;
}

async function stitchAllBooks({ language = 'en', profile = 'gpu', bookId = null, limit = null, progressFile = null }) {
    if (limit !== null && (Number.isNaN(limit) || limit <= 0)) {
        throw new Error('Invalid --limit value');
    }

    const codecProfile = getCodecProfile(profile);
    const index = await loadBibleIndex(language);
    const queue = buildBookQueue(index, bookId);
    if (queue.length === 0) {
        throw new Error(bookId ? `No matching book found for ${bookId}` : 'No books with audio found');
    }

    const progressPath = progressFile
        ? path.resolve(process.cwd(), progressFile)
        : path.join(scriptureVideoRoot, 'progress', `books.${language}.${codecProfile.id}.json`);
    const existingProgress = await loadProgress(progressPath);
    const startIndex = bookId ? 0 : findResumeIndex(queue, existingProgress);
    const queueEnd = limit === null ? queue.length : Math.min(queue.length, startIndex + limit);
    const activeQueue = queue.slice(startIndex, queueEnd);

    if (activeQueue.length === 0) {
        return { message: 'No books left to stitch.', progressPath };
    }

    const startedAt = existingProgress?.startedAt || new Date().toISOString();
    await writeJson(progressPath, {
        language,
        profile: codecProfile.id,
        startedAt,
        totalBooks: queue.length,
        lastCompleted: existingProgress?.lastCompleted || null,
        nextPlanned: activeQueue[0],
        status: 'running',
    });

    const reports = [];
    let completedCount = startIndex;
    for (const book of activeQueue) {
        console.log(`Stitching ${book.bookName} (${completedCount + 1}/${queue.length})`);
        const report = await stitchBook({ language, book, codecProfile });
        reports.push(report);
        completedCount += 1;

        await writeJson(progressPath, {
            language,
            profile: codecProfile.id,
            startedAt,
            updatedAt: new Date().toISOString(),
            totalBooks: queue.length,
            completedCount,
            lastCompleted: {
                bookId: book.bookId,
                bookName: book.bookName,
            },
            nextPlanned: queue[completedCount] || null,
            status: completedCount >= queue.length ? 'completed' : 'running',
            lastOutputPath: report.outputPath,
        });
    }

    return {
        language,
        profile: codecProfile.id,
        progressPath,
        stitchedCount: reports.length,
        lastResult: reports[reports.length - 1],
    };
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const result = await stitchAllBooks({
        language: args.language || 'en',
        profile: args.profile || 'gpu',
        bookId: args.book || null,
        limit: args.limit ? parseInt(args.limit, 10) : null,
        progressFile: args.progressFile || null,
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
    stitchAllBooks,
    stitchBook,
};
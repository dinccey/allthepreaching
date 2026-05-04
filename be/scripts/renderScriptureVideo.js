const fs = require('fs/promises');
const path = require('path');
const { loadChapter } = require('../services/scriptureVideo/chapterLoader');
const { probeDurationMs } = require('../services/scriptureVideo/audioProbe');
const { buildTimeline } = require('../services/scriptureVideo/timelineBuilder');
const { writeSubtitles } = require('../services/scriptureVideo/subtitleRenderer');
const { writeYouTubeSubtitles } = require('../services/scriptureVideo/youtubeSubtitleRenderer');
const { renderChapterVideo } = require('../services/scriptureVideo/ffmpegRunner');
const { getCodecProfile } = require('../services/scriptureVideo/codecProfiles');

function parseArgs(argv) {
    const parsed = {};
    for (let index = 0; index < argv.length; index += 1) {
        const token = argv[index];
        if (!token.startsWith('--')) {
            continue;
        }

        parsed[token.slice(2)] = argv[index + 1];
        index += 1;
    }
    return parsed;
}

async function ensureDir(dirPath) {
    await fs.mkdir(dirPath, { recursive: true });
}

async function renderChapter({ language = 'en', bookId, chapter, profile = 'social' }) {
    if (!bookId || !chapter) {
        throw new Error('Usage: node be/scripts/renderScriptureVideo.js --language en --book genesis --chapter 1');
    }

    const projectRoot = path.resolve(__dirname, '..', '..');
    const scriptureVideoRoot = path.join(projectRoot, 'be', 'data', 'scripture-video');
    const codecProfile = getCodecProfile(profile);
    const chapterRecord = await loadChapter({ language, bookId, chapter });
    let chapterIntroDurationMs = 0;

    if (chapterRecord.audio?.chapterIntro?.available && chapterRecord.absolutePaths?.chapterIntro) {
        chapterIntroDurationMs = await probeDurationMs(chapterRecord.absolutePaths.chapterIntro);
    }

    const verseDurationsMs = new Map();
    for (const verse of chapterRecord.verses) {
        if (!verse.hasAudio || !verse.absoluteAudioPath) {
            throw new Error(`Cannot render chapter with missing verse audio: ${bookId} ${chapter}:${verse.verse}`);
        }

        verseDurationsMs.set(verse.verse, await probeDurationMs(verse.absoluteAudioPath));
    }

    const manifest = buildTimeline({
        chapter: chapterRecord,
        verseDurationsMs,
        chapterIntroDurationMs,
    });

    const baseName = `${bookId}-${String(chapterRecord.chapter).padStart(3, '0')}`;
    const outputBaseName = codecProfile.id === 'social'
        ? baseName
        : `${baseName}.${codecProfile.id}`;
    const workRoot = path.join(scriptureVideoRoot, 'work', language, bookId, baseName);
    const manifestPath = path.join(scriptureVideoRoot, 'manifests', language, bookId, `${baseName}.json`);
    const subtitlePath = path.join(scriptureVideoRoot, 'subtitles', language, bookId, `${baseName}.ass`);
    const concatListPath = path.join(workRoot, `${baseName}.concat.txt`);
    const audioOutputPath = path.join(scriptureVideoRoot, 'audio', language, bookId, `${baseName}.mp3`);
    const outputPath = path.join(scriptureVideoRoot, 'output', language, bookId, `${outputBaseName}.${codecProfile.containerExtension}`);
    const youtubeSubtitlePath = path.join(scriptureVideoRoot, 'output', language, bookId, `${outputBaseName}.srt`);
    const reportPath = path.join(scriptureVideoRoot, 'reports', language, bookId, `${outputBaseName}.json`);

    await Promise.all([
        ensureDir(path.dirname(manifestPath)),
        ensureDir(path.dirname(subtitlePath)),
        ensureDir(path.dirname(audioOutputPath)),
        ensureDir(path.dirname(outputPath)),
        ensureDir(path.dirname(reportPath)),
        ensureDir(workRoot),
    ]);

    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
    await writeSubtitles({ manifest, subtitlePath });
    await writeYouTubeSubtitles({ manifest, outputPath: youtubeSubtitlePath });
    const resolvedCodecProfile = await renderChapterVideo({
        manifest,
        subtitlePath,
        audioOutputPath,
        concatListPath,
        outputPath,
        workingDirectory: path.dirname(subtitlePath),
        codecProfileName: codecProfile.id,
    });

    const report = {
        language,
        bookId,
        chapter: chapterRecord.chapter,
        renderedAt: new Date().toISOString(),
        profile: resolvedCodecProfile.id,
        videoCodec: resolvedCodecProfile.videoCodec,
        audioCodec: resolvedCodecProfile.audioCodec,
        durationMs: manifest.totalDurationMs,
        verseCount: chapterRecord.verses.length,
        includesChapterIntro: manifest.audio.includesChapterIntro,
        youtubeSubtitlePath,
        outputPath,
        warnings: [],
    };
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

    return { manifestPath, subtitlePath, youtubeSubtitlePath, audioOutputPath, outputPath, reportPath };
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const result = await renderChapter({
        language: args.language || 'en',
        bookId: args.book,
        chapter: args.chapter,
        profile: args.profile || 'social',
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
    renderChapter,
    parseArgs,
};
const { parseArgs, renderChapter } = require('./renderScriptureVideo');
const { generateManifest } = require('./buildYouTubeUploadManifest');

function parseChapterSelection(args) {
    if (args.chapters) {
        return args.chapters
            .split(',')
            .map((value) => parseInt(value.trim(), 10))
            .filter((value) => !Number.isNaN(value) && value > 0);
    }

    const startChapter = args.startChapter ? parseInt(args.startChapter, 10) : null;
    const endChapter = args.endChapter ? parseInt(args.endChapter, 10) : null;

    if (startChapter !== null && endChapter !== null && endChapter >= startChapter) {
        return Array.from({ length: endChapter - startChapter + 1 }, (_, index) => startChapter + index);
    }

    if (startChapter !== null) {
        return [startChapter];
    }

    return [];
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const language = args.language || 'en';
    const profile = args.profile || 'gpu';
    const bookId = args.book;
    const chapters = parseChapterSelection(args);

    if (!bookId || chapters.length === 0) {
        throw new Error('Usage: node scripts/prepareScriptureYouTubeBundle.js --language en --profile gpu --book genesis --chapters 13,16');
    }

    const rendered = [];
    for (const chapter of chapters) {
        rendered.push(await renderChapter({
            language,
            profile,
            bookId,
            chapter,
        }));
    }

    const manifest = await generateManifest({
        language,
        profile,
        privacyStatus: args.privacyStatus || 'private',
        categoryId: args.categoryId || '27',
        onlyExisting: true,
        book: bookId,
        chapters: chapters.join(','),
    });

    console.log(JSON.stringify({
        language,
        profile,
        bookId,
        chapters,
        renderedCount: rendered.length,
        manifest,
    }, null, 2));
}

main().catch((error) => {
    console.error(error.stack || error.message);
    process.exit(1);
});
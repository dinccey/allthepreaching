const { parseArgs } = require('./renderScriptureVideo');
const { renderAllChapters } = require('./renderAllScriptureVideos');
const { generateManifest } = require('./buildYouTubeUploadManifest');

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const language = args.language || 'en';
    const profile = args.profile || 'gpu';
    const privacyStatus = args.privacyStatus || 'private';
    const categoryId = args.categoryId || '27';
    const limit = args.limit ? parseInt(args.limit, 10) : null;

    const renderResult = await renderAllChapters({
        language,
        profile,
        limit,
        progressFile: args.progressFile || null,
    });

    const manifestResult = await generateManifest({
        language,
        profile,
        privacyStatus,
        categoryId,
        onlyExisting: true,
    });

    console.log(JSON.stringify({
        language,
        profile,
        renderResult,
        manifestResult,
    }, null, 2));
}

main().catch((error) => {
    console.error(error.stack || error.message);
    process.exit(1);
});
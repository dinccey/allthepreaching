const fs = require('fs/promises');
const path = require('path');

function formatSrtTime(totalMs) {
    const hours = Math.floor(totalMs / 3600000);
    const minutes = Math.floor((totalMs % 3600000) / 60000);
    const seconds = Math.floor((totalMs % 60000) / 1000);
    const milliseconds = totalMs % 1000;

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')},${String(milliseconds).padStart(3, '0')}`;
}

function sanitizeSubtitleText(text) {
    return text
        .replace(/\r?\n/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

async function writeYouTubeSubtitles({ manifest, outputPath }) {
    const verseEntries = manifest.timeline.filter((entry) => entry.type === 'verse');
    const blocks = verseEntries.map((entry, index) => ([
        String(index + 1),
        `${formatSrtTime(entry.startMs)} --> ${formatSrtTime(entry.endMs)}`,
        `${entry.verse}. ${sanitizeSubtitleText(entry.text)}`,
        '',
    ].join('\n')));

    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, blocks.join('\n'), 'utf8');
}

module.exports = {
    writeYouTubeSubtitles,
};
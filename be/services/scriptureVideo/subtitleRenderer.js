const fs = require('fs/promises');
const path = require('path');
const { getTheme } = require('./theme');

function formatAssTime(totalMs) {
    const centiseconds = Math.floor(totalMs / 10);
    const hours = Math.floor(centiseconds / 360000);
    const minutes = Math.floor((centiseconds % 360000) / 6000);
    const seconds = Math.floor((centiseconds % 6000) / 100);
    const cs = centiseconds % 100;
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

function wrapText(text, lineLength = 30) {
    const words = text.trim().split(/\s+/);
    const lines = [];
    let current = '';

    for (const word of words) {
        const candidate = current ? `${current} ${word}` : word;
        if (candidate.length > lineLength && current) {
            lines.push(current);
            current = word;
        } else {
            current = candidate;
        }
    }

    if (current) {
        lines.push(current);
    }

    return lines.join('\\N');
}

function sanitizeAssText(text) {
    return text
        .replace(/\{/g, '(')
        .replace(/\}/g, ')')
        .replace(/\r?\n/g, ' ')
        .trim();
}

function countWrappedLines(text) {
    return text ? text.split('\\N').length : 0;
}

function getVersePresentation(text) {
    const cleanText = sanitizeAssText(text);
    const layoutOptions = [
        { fontSize: 62, lineLength: 52, maxLines: 9 },
        { fontSize: 58, lineLength: 56, maxLines: 10 },
        { fontSize: 54, lineLength: 60, maxLines: 10 },
        { fontSize: 50, lineLength: 64, maxLines: 11 },
        { fontSize: 46, lineLength: 68, maxLines: 12 },
    ];

    for (const option of layoutOptions) {
        const wrappedText = wrapText(cleanText, option.lineLength);
        if (countWrappedLines(wrappedText) <= option.maxLines) {
            return {
                fontSize: option.fontSize,
                wrappedText,
            };
        }
    }

    const fallback = layoutOptions[layoutOptions.length - 1];
    return {
        fontSize: fallback.fontSize,
        wrappedText: wrapText(cleanText, fallback.lineLength),
    };
}

async function writeSubtitles({ manifest, subtitlePath }) {
    const theme = getTheme(manifest.video.theme);
    const chapterText = `${manifest.reference.bookName} ${manifest.reference.chapter}`;
    const events = [
        `Dialogue: 0,${formatAssTime(0)},${formatAssTime(manifest.totalDurationMs)},Chapter,,0,0,0,,${chapterText}`,
        ...manifest.timeline
            .filter((entry) => entry.type === 'verse')
            .map((entry) => {
                const presentation = getVersePresentation(entry.text);
                return `Dialogue: 0,${formatAssTime(entry.startMs)},${formatAssTime(entry.endMs)},Verse,,0,0,0,,{\\fad(180,220)}{\\fs${presentation.fontSize}}{\\c${theme.accentColor}}${entry.verse}.{\\rVerse}{\\fs${presentation.fontSize}} ${presentation.wrappedText}`;
            }),
    ];

    const ass = [
        '[Script Info]',
        'ScriptType: v4.00+',
        `PlayResX: ${manifest.video.width}`,
        `PlayResY: ${manifest.video.height}`,
        'WrapStyle: 2',
        'ScaledBorderAndShadow: yes',
        '',
        '[V4+ Styles]',
        'Format: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding',
        `Style: Chapter,${theme.fontName},54,${theme.headingColor},${theme.headingColor},${theme.outlineColor},${theme.shadowColor},1,0,0,0,100,100,0,0,1,1.6,0,8,120,120,88,1`,
        `Style: Verse,${theme.fontName},62,${theme.primaryTextColor},${theme.primaryTextColor},${theme.outlineColor},${theme.shadowColor},0,0,0,0,100,100,0,0,1,1,0,5,80,80,180,1`,
        '',
        '[Events]',
        'Format: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text',
        ...events,
        '',
    ].join('\n');

    await fs.mkdir(path.dirname(subtitlePath), { recursive: true });
    await fs.writeFile(subtitlePath, ass, 'utf8');
}

module.exports = {
    writeSubtitles,
};
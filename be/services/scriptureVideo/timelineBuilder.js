function buildTimeline({ chapter, verseDurationsMs, chapterIntroDurationMs = 0 }) {
    let cursorMs = 0;
    const timeline = [];

    if (chapter.audio?.chapterIntro?.available && chapter.absolutePaths?.chapterIntro && chapterIntroDurationMs > 0) {
        const startMs = cursorMs;
        const endMs = startMs + chapterIntroDurationMs;
        timeline.push({
            type: 'chapter-intro',
            startMs,
            endMs,
            durationMs: chapterIntroDurationMs,
            audioPath: chapter.absolutePaths.chapterIntro,
        });
        cursorMs = endMs;
    }

    chapter.verses.forEach((verse) => {
        if (!verse.hasAudio || !verse.absoluteAudioPath) {
            throw new Error(`Missing verse audio for ${chapter.book.name} ${chapter.chapter}:${verse.verse}`);
        }

        const durationMs = verseDurationsMs.get(verse.verse);
        if (!durationMs) {
            throw new Error(`Missing verse duration for ${chapter.book.name} ${chapter.chapter}:${verse.verse}`);
        }

        const startMs = cursorMs;
        const endMs = startMs + durationMs;
        cursorMs = endMs;

        timeline.push({
            type: 'verse',
            verse: verse.verse,
            startMs,
            endMs,
            durationMs,
            text: verse.text,
            audioPath: verse.absoluteAudioPath,
        });
    });

    return {
        video: {
            width: parseInt(process.env.SCRIPTURE_VIDEO_WIDTH || '1920', 10),
            height: parseInt(process.env.SCRIPTURE_VIDEO_HEIGHT || '1080', 10),
            fps: parseInt(process.env.SCRIPTURE_VIDEO_FPS || '30', 10),
            theme: process.env.SCRIPTURE_VIDEO_THEME || 'simple-reader',
        },
        reference: {
            language: chapter.language,
            translationLabel: chapter.translationLabel,
            bookId: chapter.book.id,
            bookName: chapter.book.name,
            chapter: chapter.chapter,
        },
        audio: {
            includesChapterIntro: timeline.some((entry) => entry.type === 'chapter-intro'),
        },
        totalDurationMs: cursorMs,
        timeline,
    };
}

module.exports = {
    buildTimeline,
};
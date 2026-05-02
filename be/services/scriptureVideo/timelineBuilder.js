function buildTimeline({ chapter, verseDurationsMs, bookIntroDurationMs = 0 }) {
    let cursorMs = 0;
    const timeline = [];

    if (chapter.chapter === 1 && chapter.audio?.bookIntro?.available && chapter.absolutePaths?.bookIntro && bookIntroDurationMs > 0) {
        timeline.push({
            type: 'book-intro',
            startMs: 0,
            endMs: bookIntroDurationMs,
            durationMs: bookIntroDurationMs,
            audioPath: chapter.absolutePaths.bookIntro,
        });
        cursorMs = bookIntroDurationMs;
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
            includesBookIntro: timeline.some((entry) => entry.type === 'book-intro'),
        },
        totalDurationMs: cursorMs,
        timeline,
    };
}

module.exports = {
    buildTimeline,
};
import type { BibleBookMeta, BibleChapter } from '@/hooks/useBible';

interface BibleNavigatorProps {
    books: BibleBookMeta[];
    chapterData: BibleChapter;
    selectedVerse: number;
    onBookChange: (bookId: string) => void;
    onChapterChange: (chapter: number) => void;
    onVerseChange: (verse: number) => void;
    onGoToVerse: () => void;
    onPlaySelectedVerse: () => void;
}

export default function BibleNavigator({
    books,
    chapterData,
    selectedVerse,
    onBookChange,
    onChapterChange,
    onVerseChange,
    onGoToVerse,
    onPlaySelectedVerse,
}: BibleNavigatorProps) {
    const chapterOptions = Array.from({ length: chapterData.chapterCount }, (_, index) => index + 1);
    const verseOptions = chapterData.verses.map((verse) => verse.verse);

    return (
        <div className="rounded-[1.5rem] border border-primary/12 bg-scheme-e-bg/92 p-4 shadow-md">
            <div className="grid gap-3 md:grid-cols-[minmax(0,1.5fr)_120px_120px_auto] md:items-end">
                <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.16em] text-scheme-e-text/65">
                    Book
                    <select
                        value={chapterData.book.id}
                        onChange={(event) => onBookChange(event.target.value)}
                        className="rounded-xl border border-primary/15 bg-scheme-c-bg/75 px-3 py-2.5 text-sm font-medium normal-case tracking-normal text-scheme-e-text"
                    >
                        {books.map((book) => (
                            <option key={book.bookId} value={book.bookId}>
                                {book.name}
                            </option>
                        ))}
                    </select>
                </label>

                <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.16em] text-scheme-e-text/65">
                    Chapter
                    <select
                        value={chapterData.chapter}
                        onChange={(event) => onChapterChange(parseInt(event.target.value, 10))}
                        className="rounded-xl border border-primary/15 bg-scheme-c-bg/75 px-3 py-2.5 text-sm font-medium normal-case tracking-normal text-scheme-e-text"
                    >
                        {chapterOptions.map((chapter) => (
                            <option key={chapter} value={chapter}>
                                {chapter}
                            </option>
                        ))}
                    </select>
                </label>

                <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.16em] text-scheme-e-text/65">
                    Verse
                    <select
                        value={selectedVerse}
                        onChange={(event) => onVerseChange(parseInt(event.target.value, 10))}
                        className="rounded-xl border border-primary/15 bg-scheme-c-bg/75 px-3 py-2.5 text-sm font-medium normal-case tracking-normal text-scheme-e-text"
                    >
                        {verseOptions.map((verse) => (
                            <option key={verse} value={verse}>
                                {verse}
                            </option>
                        ))}
                    </select>
                </label>

                <div className="grid grid-cols-2 gap-2 md:grid-cols-1 lg:grid-cols-2">
                    <button
                        type="button"
                        onClick={onGoToVerse}
                        className="rounded-xl border border-primary/20 px-4 py-2.5 text-sm font-semibold text-scheme-e-text transition-colors hover:border-primary hover:text-primary"
                    >
                        Go
                    </button>
                    <button
                        type="button"
                        onClick={onPlaySelectedVerse}
                        className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-scheme-c-bg transition-opacity hover:opacity-90"
                    >
                        Play
                    </button>
                </div>
            </div>
        </div>
    );
}
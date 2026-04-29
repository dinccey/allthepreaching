import type { BibleVerse } from '@/hooks/useBible';

interface VerseListProps {
    verses: BibleVerse[];
    activeVerse: number | null;
    onSelectVerse: (verse: BibleVerse) => void;
    registerVerseRef: (verse: number, element: HTMLButtonElement | null) => void;
}

export default function VerseList({ verses, activeVerse, onSelectVerse, registerVerseRef }: VerseListProps) {
    return (
        <div className="rounded-[1.75rem] border border-primary/12 bg-scheme-e-bg/92 px-4 py-5 shadow-lg sm:px-6">
            {verses.map((verse) => {
                const isActive = activeVerse === verse.verse;

                return (
                    <button
                        key={verse.verse}
                        ref={(element) => registerVerseRef(verse.verse, element)}
                        type="button"
                        onClick={() => onSelectVerse(verse)}
                        className={`block w-full rounded-xl px-2 py-2 text-left transition-colors ${isActive
                            ? 'bg-primary/10 text-scheme-e-heading'
                            : 'text-scheme-e-text hover:bg-primary/5'
                            }`}
                    >
                        <span className="inline align-top">
                            <span className={`mr-2 inline-flex min-w-7 items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-bold leading-none ${isActive
                                ? 'bg-primary text-scheme-c-bg'
                                : 'bg-scheme-c-bg text-primary'
                                }`}>
                                {verse.verse}
                            </span>
                            <span className={`text-[1.04rem] leading-8 ${isActive ? 'font-medium' : ''}`}>
                                {verse.text}
                            </span>
                            {!verse.hasAudio ? (
                                <span className="ml-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-scheme-e-text/45">
                                    no audio
                                </span>
                            ) : null}
                        </span>
                    </button>
                );
            })}
        </div>
    );
}
interface BibleSessionEntry {
    id: string;
    language: string;
    bookId: string;
    bookName: string;
    chapter: number;
    verse: number;
    updatedAt: string;
}

interface BibleSessionHistoryProps {
    sessions: BibleSessionEntry[];
    onSelectSession: (session: BibleSessionEntry) => void;
}

export type { BibleSessionEntry };

export default function BibleSessionHistory({ sessions, onSelectSession }: BibleSessionHistoryProps) {
    if (!sessions.length) {
        return null;
    }

    return (
        <div className="rounded-[1.5rem] border border-primary/12 bg-scheme-e-bg/92 p-4 shadow-md">
            <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-scheme-e-text/65">Recent listening</h2>
                <span className="text-xs text-scheme-e-text/50">Last played positions</span>
            </div>

            <div className="mt-3 flex snap-x gap-2 overflow-x-auto pb-1">
                {sessions.map((session) => (
                    <button
                        key={session.id}
                        type="button"
                        onClick={() => onSelectSession(session)}
                        className="min-w-[180px] snap-start rounded-2xl border border-primary/12 bg-scheme-c-bg/70 px-4 py-3 text-left transition-colors hover:border-primary/35 hover:bg-scheme-c-bg"
                    >
                        <div className="text-sm font-semibold text-scheme-e-heading">{session.bookName} {session.chapter}:{session.verse}</div>
                        <div className="mt-1 text-[11px] font-medium uppercase tracking-[0.18em] text-scheme-e-text/55">
                            Last stopped here
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
}
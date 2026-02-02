import Link from 'next/link';

interface SubtitleHit {
    timestamp: string;
    text: string;
}

interface SubtitlesResultCardProps {
    author?: string;
    title?: string;
    videoDate?: string;
    subtitlePath?: string;
    videoId?: number | string;
    subtitles?: SubtitleHit[];
}

const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    const parsed = new Date(dateStr);
    if (Number.isNaN(parsed.getTime())) return dateStr;
    return parsed.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

const parseTimestampToSeconds = (value?: string) => {
    if (!value) return 0;
    if (/^\d+(\.\d+)?$/.test(value)) {
        return Math.floor(parseFloat(value));
    }

    const parts = value.split(':').map((part) => parseFloat(part));
    if (parts.some((part) => Number.isNaN(part))) {
        return 0;
    }

    if (parts.length === 3) {
        return Math.floor(parts[0] * 3600 + parts[1] * 60 + parts[2]);
    }
    if (parts.length === 2) {
        return Math.floor(parts[0] * 60 + parts[1]);
    }
    return Math.floor(parts[0]);
};

const formatTimestamp = (value?: string) => {
    const totalSeconds = parseTimestampToSeconds(value);
    if (!totalSeconds && value) {
        return value;
    }
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);
    const paddedMinutes = hours > 0 ? String(minutes).padStart(2, '0') : String(minutes);
    const paddedSeconds = String(seconds).padStart(2, '0');
    return hours > 0 ? `${hours}:${paddedMinutes}:${paddedSeconds}` : `${paddedMinutes}:${paddedSeconds}`;
};

export default function SubtitlesResultCard({
    author,
    title,
    videoDate,
    subtitlePath,
    videoId,
    subtitles = []
}: SubtitlesResultCardProps) {
    const visibleHits = subtitles.slice(0, 6);
    const primaryTimestamp = visibleHits[0]?.timestamp;
    const primarySeconds = Math.max(0, parseTimestampToSeconds(primaryTimestamp) - 5);

    return (
        <div className="card card-gradient flex flex-col gap-4">
            <div className="space-y-2">
                <div className="text-sm text-secondary-light/80 uppercase tracking-wide">
                    Subtitle match
                </div>
                <div className="text-lg font-semibold text-scheme-c-text">
                    {videoId ? (
                        <Link
                            href={`/video/${videoId}${primaryTimestamp ? `?t=${primarySeconds}` : ''}`}
                            className="hover:text-primary transition-colors"
                        >
                            {author && <span className="text-primary">{author}</span>}
                            {author && title && <span className="text-scheme-c-text/80">: </span>}
                            <span className="text-scheme-c-text/90">{title || 'Untitled Sermon'}</span>
                        </Link>
                    ) : (
                        <>
                            {author && <span className="text-primary">{author}</span>}
                            {author && title && <span className="text-scheme-c-text/80">: </span>}
                            <span className="text-scheme-c-text/90">{title || 'Untitled Sermon'}</span>
                        </>
                    )}
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-secondary-light/80">
                    {videoDate && <span>{formatDate(videoDate)}</span>}
                </div>
            </div>

            <div className="space-y-2">
                {visibleHits.map((hit, index) => {
                    const content = (
                        <div className="flex flex-col gap-1">
                            <span className="text-xs font-semibold text-primary/90">
                                {formatTimestamp(hit.timestamp)}
                            </span>
                            <span className="text-sm text-scheme-c-text/80">{hit.text}</span>
                        </div>
                    );

                    if (videoId) {
                        const seconds = Math.max(0, parseTimestampToSeconds(hit.timestamp) - 5);
                        return (
                            <Link
                                key={`${hit.timestamp}-${index}`}
                                href={`/video/${videoId}?t=${seconds}`}
                                className="block rounded-lg border border-secondary-dark/40 bg-scheme-c-bg/40 px-4 py-3 transition-all duration-300 hover:border-primary/60 hover:bg-scheme-c-bg/60"
                            >
                                {content}
                            </Link>
                        );
                    }

                    return (
                        <div
                            key={`${hit.timestamp}-${index}`}
                            className="rounded-lg border border-secondary-dark/40 bg-scheme-c-bg/40 px-4 py-3"
                        >
                            {content}
                        </div>
                    );
                })}
            </div>

            {subtitles.length > visibleHits.length && (
                <div className="text-xs text-secondary-light/80">
                    Showing {visibleHits.length} of {subtitles.length} matches
                </div>
            )}
        </div>
    );
}

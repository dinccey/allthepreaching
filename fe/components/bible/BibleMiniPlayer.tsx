import { RefObject, useEffect, useState } from 'react';

interface BibleMiniPlayerProps {
    audioRef: RefObject<HTMLAudioElement | null>;
    audioSrc: string | null;
    currentReferenceLabel: string;
    onReferenceClick: () => void;
    isPlaying: boolean;
    playbackRate: number;
    onPlaybackRateChange: (rate: number) => void;
    onEnded: () => void;
    onCanPlay: () => void;
    onPlay: () => void;
    onPause: () => void;
    onTogglePlayback: () => void;
    onPrevious: () => void;
    onNext: () => void;
    canGoPrevious: boolean;
    canGoNext: boolean;
}

const playbackRates = [0.75, 1, 1.25, 1.5, 2];

export default function BibleMiniPlayer({
    audioRef,
    audioSrc,
    currentReferenceLabel,
    onReferenceClick,
    isPlaying,
    playbackRate,
    onPlaybackRateChange,
    onEnded,
    onCanPlay,
    onPlay,
    onPause,
    onTogglePlayback,
    onPrevious,
    onNext,
    canGoPrevious,
    canGoNext,
}: BibleMiniPlayerProps) {
    const [isFloatingVisible, setIsFloatingVisible] = useState(false);

    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }

        const updateVisibility = () => {
            setIsFloatingVisible(window.scrollY > 280);
        };

        updateVisibility();
        window.addEventListener('scroll', updateVisibility, { passive: true });

        return () => window.removeEventListener('scroll', updateVisibility);
    }, []);

    if (!audioSrc) {
        return null;
    }

    return (
        <>
            <div className={`fixed left-1/2 top-24 z-30 w-[min(56rem,calc(100vw-1rem))] -translate-x-1/2 px-1 transition-all duration-200 sm:px-0 ${isFloatingVisible ? 'pointer-events-auto opacity-100 translate-y-0' : 'pointer-events-none -translate-y-3 opacity-0'}`}>
                <div className="rounded-[1.35rem] border border-secondary-dark/45 bg-scheme-e-bg/90 shadow-[0_18px_45px_rgba(0,0,0,0.28)] backdrop-blur-xl">
                    <div className="flex items-center gap-2 p-2.5 sm:gap-3 sm:p-3">
                        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
                            <button
                                type="button"
                                onClick={onReferenceClick}
                                className="min-w-0 truncate rounded-full border border-primary/14 bg-scheme-c-bg/70 px-3 py-2 text-center text-sm font-semibold text-scheme-e-heading transition-colors hover:border-primary/45 hover:bg-scheme-c-bg"
                            >
                                {currentReferenceLabel}
                            </button>

                            <button
                                type="button"
                                onClick={onPrevious}
                                disabled={!canGoPrevious}
                                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-primary/18 bg-scheme-c-bg/78 text-scheme-e-heading transition-colors hover:border-primary/45 hover:bg-scheme-c-bg disabled:cursor-not-allowed disabled:opacity-45"
                                aria-label="Previous verse"
                            >
                                <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4">
                                    <path fill="currentColor" d="M12.78 4.97a.75.75 0 0 1 0 1.06L8.81 10l3.97 3.97a.75.75 0 1 1-1.06 1.06l-4.5-4.5a.75.75 0 0 1 0-1.06l4.5-4.5a.75.75 0 0 1 1.06 0Z" />
                                </svg>
                            </button>

                            <button
                                type="button"
                                onClick={onTogglePlayback}
                                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-scheme-c-bg shadow-[0_10px_24px_rgba(164,104,40,0.28)] transition-transform hover:scale-[1.02] hover:opacity-95"
                                aria-label={isPlaying ? 'Pause playback' : 'Start playback'}
                            >
                                {isPlaying ? (
                                    <svg aria-hidden="true" viewBox="0 0 20 20" className="h-6 w-6">
                                        <path fill="currentColor" d="M6.25 4.5A.75.75 0 0 1 7 5.25v9.5a.75.75 0 0 1-1.5 0v-9.5a.75.75 0 0 1 .75-.75Zm6 0a.75.75 0 0 1 .75.75v9.5a.75.75 0 0 1-1.5 0v-9.5a.75.75 0 0 1 .75-.75Z" />
                                    </svg>
                                ) : (
                                    <svg aria-hidden="true" viewBox="0 0 20 20" className="ml-0.5 h-6 w-6">
                                        <path fill="currentColor" d="M6.5 4.96c0-1.13 1.24-1.82 2.2-1.22l7.07 4.39c.9.56.9 1.88 0 2.44L8.7 14.96c-.96.6-2.2-.09-2.2-1.22V4.96Z" />
                                    </svg>
                                )}
                            </button>

                            <button
                                type="button"
                                onClick={onNext}
                                disabled={!canGoNext}
                                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-primary/18 bg-scheme-c-bg/78 text-scheme-e-heading transition-colors hover:border-primary/45 hover:bg-scheme-c-bg disabled:cursor-not-allowed disabled:opacity-45"
                                aria-label="Next verse"
                            >
                                <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4">
                                    <path fill="currentColor" d="M7.22 4.97a.75.75 0 0 0 0 1.06L11.19 10l-3.97 3.97a.75.75 0 1 0 1.06 1.06l4.5-4.5a.75.75 0 0 0 0-1.06l-4.5-4.5a.75.75 0 0 0-1.06 0Z" />
                                </svg>
                            </button>
                        </div>

                        <label className="flex shrink-0 items-center gap-1.5 rounded-full border border-primary/18 bg-scheme-c-bg/74 px-2.5 py-2 text-xs font-semibold text-scheme-e-heading">
                            <svg aria-hidden="true" viewBox="0 0 20 20" className="h-3.5 w-3.5 text-primary/80">
                                <path fill="currentColor" d="M10 3.75a.75.75 0 0 1 .75.75v5.19l3.28 1.9a.75.75 0 0 1-.75 1.3l-3.66-2.12A.75.75 0 0 1 9.25 10V4.5A.75.75 0 0 1 10 3.75Z" />
                                <path fill="currentColor" d="M10 1.5a8.5 8.5 0 1 0 8.5 8.5A8.51 8.51 0 0 0 10 1.5Zm0 15.5a7 7 0 1 1 7-7 7.01 7.01 0 0 1-7 7Z" />
                            </svg>
                            <select
                                value={playbackRate}
                                onChange={(event) => onPlaybackRateChange(parseFloat(event.target.value))}
                                className="bg-transparent text-sm font-semibold tracking-normal text-scheme-e-heading outline-none"
                                aria-label="Playback speed"
                            >
                                {playbackRates.map((rate) => (
                                    <option key={rate} value={rate}>
                                        {rate}x
                                    </option>
                                ))}
                            </select>
                        </label>

                        <audio
                            ref={audioRef}
                            className="hidden"
                            src={audioSrc}
                            onEnded={onEnded}
                            onCanPlay={onCanPlay}
                            onPlay={onPlay}
                            onPause={onPause}
                        >
                            Your browser does not support the audio element.
                        </audio>
                    </div>
                </div>
            </div>
        </>
    );
}
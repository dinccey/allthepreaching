import { RefObject } from 'react';

interface BibleMiniPlayerProps {
    audioRef: RefObject<HTMLAudioElement | null>;
    audioSrc: string | null;
    currentReferenceLabel: string;
    playbackRate: number;
    onPlaybackRateChange: (rate: number) => void;
    sleepTimer: string;
    onSleepTimerChange: (value: string) => void;
    onEnded: () => void;
    onPlay: () => void;
    onPause: () => void;
}

const playbackRates = [0.75, 1, 1.25, 1.5, 2];

export default function BibleMiniPlayer({
    audioRef,
    audioSrc,
    currentReferenceLabel,
    playbackRate,
    onPlaybackRateChange,
    sleepTimer,
    onSleepTimerChange,
    onEnded,
    onPlay,
    onPause,
}: BibleMiniPlayerProps) {
    if (!audioSrc) {
        return null;
    }

    return (
        <div className="sticky bottom-3 z-20 mt-4 rounded-[1.5rem] border border-primary/18 bg-scheme-b-bg/96 p-3 shadow-xl backdrop-blur sm:p-4">
            <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary/75">Now Playing</div>
                        <div className="mt-1 text-base font-semibold text-scheme-b-heading sm:text-lg">{currentReferenceLabel}</div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 sm:min-w-[260px]">
                        <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.18em] text-scheme-b-text/70">
                            Speed
                            <select
                                value={playbackRate}
                                onChange={(event) => onPlaybackRateChange(parseFloat(event.target.value))}
                                className="rounded-xl border border-primary/20 bg-scheme-c-bg/80 px-3 py-2 text-sm font-medium tracking-normal text-scheme-e-text"
                            >
                                {playbackRates.map((rate) => (
                                    <option key={rate} value={rate}>
                                        {rate}x
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.18em] text-scheme-b-text/70">
                            Timer
                            <select
                                value={sleepTimer}
                                onChange={(event) => onSleepTimerChange(event.target.value)}
                                className="rounded-xl border border-primary/20 bg-scheme-c-bg/80 px-3 py-2 text-sm font-medium tracking-normal text-scheme-e-text"
                            >
                                <option value="">Off</option>
                                <option value="15">15 min</option>
                                <option value="30">30 min</option>
                                <option value="45">45 min</option>
                                <option value="60">60 min</option>
                                <option value="chapter">End of chapter</option>
                            </select>
                        </label>
                    </div>
                </div>

                <audio
                    ref={audioRef}
                    controls
                    className="w-full"
                    src={audioSrc}
                    onEnded={onEnded}
                    onPlay={onPlay}
                    onPause={onPause}
                >
                    Your browser does not support the audio element.
                </audio>
            </div>
        </div>
    );
}
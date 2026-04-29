import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useRef, useState } from 'react';
import BibleNavigator from '@/components/bible/BibleNavigator';
import BibleMiniPlayer from '@/components/bible/BibleMiniPlayer';
import BibleSessionHistory, { type BibleSessionEntry } from '@/components/bible/BibleSessionHistory';
import VerseList from '@/components/bible/VerseList';
import { BibleVerse, useBibleChapter, useBibleMeta } from '@/hooks/useBible';

const LAST_BIBLE_POSITION_KEY = 'atp_bible_last_position';
const PLAYBACK_RATE_KEY = 'atp_bible_playback_rate';
const FOLLOW_AUDIO_KEY = 'atp_bible_follow_audio';
const RECENT_BIBLE_SESSIONS_KEY = 'atp_bible_recent_sessions';
const SLEEP_TIMER_KEY = 'atp_bible_sleep_timer';
const SLEEP_TIMER_DEADLINE_KEY = 'atp_bible_sleep_timer_deadline';

function upsertSessionEntry(entries: BibleSessionEntry[], nextEntry: BibleSessionEntry) {
    const filtered = entries.filter((entry) => entry.id !== nextEntry.id);
    return [nextEntry, ...filtered].slice(0, 10);
}

function buildBiblePath(language: string, book: string, chapter: number | string) {
    return `/bible/${language}/${book}/${chapter}`;
}

function buildBibleLocation(
    language: string,
    book: string,
    chapter: number | string,
    options?: { verse?: number; autoplay?: boolean },
) {
    const params = new URLSearchParams();

    if (options?.verse) {
        params.set('verse', String(options.verse));
    }

    if (options?.autoplay) {
        params.set('autoplay', '1');
    }

    const query = params.toString();
    return query ? `${buildBiblePath(language, book, chapter)}?${query}` : buildBiblePath(language, book, chapter);
}

export default function BibleChapterPage() {
    const router = useRouter();
    const language = typeof router.query.language === 'string' ? router.query.language : undefined;
    const book = typeof router.query.book === 'string' ? router.query.book : undefined;
    const chapter = typeof router.query.chapter === 'string' ? router.query.chapter : undefined;
    const queryVerse = typeof router.query.verse === 'string' ? parseInt(router.query.verse, 10) : null;
    const autoplay = router.query.autoplay === '1';
    const { chapterData, isLoading, isError } = useBibleChapter(language, book, chapter);
    const { meta } = useBibleMeta(language);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const verseRefs = useRef<Record<number, HTMLButtonElement | null>>({});
    const sleepTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const handledAutoplayKeyRef = useRef<string | null>(null);
    const pendingPlaybackRef = useRef(false);
    const followScrollFrameRef = useRef<number | null>(null);
    const [activeVerse, setActiveVerse] = useState<number | null>(null);
    const [selectedVerse, setSelectedVerse] = useState(1);
    const [audioSrc, setAudioSrc] = useState<string | null>(null);
    const [playbackRate, setPlaybackRate] = useState(1);
    const [sleepTimer, setSleepTimer] = useState('');
    const [sleepTimerDeadline, setSleepTimerDeadline] = useState<number | null>(null);
    const [followAudio, setFollowAudio] = useState(true);
    const [isPlaying, setIsPlaying] = useState(false);
    const [recentSessions, setRecentSessions] = useState<BibleSessionEntry[]>([]);

    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }

        const savedRate = parseFloat(window.localStorage.getItem(PLAYBACK_RATE_KEY) || '1');
        const savedFollowAudio = window.localStorage.getItem(FOLLOW_AUDIO_KEY);
        if (!Number.isNaN(savedRate) && savedRate > 0) {
            setPlaybackRate(savedRate);
        }
        if (savedFollowAudio === '0') {
            setFollowAudio(false);
        }

        const savedSleepTimer = window.localStorage.getItem(SLEEP_TIMER_KEY) || '';
        const savedSleepTimerDeadline = window.localStorage.getItem(SLEEP_TIMER_DEADLINE_KEY);
        const parsedSleepTimerDeadline = savedSleepTimerDeadline ? parseInt(savedSleepTimerDeadline, 10) : null;

        if (savedSleepTimer === 'chapter') {
            setSleepTimer('chapter');
        } else if (savedSleepTimer && parsedSleepTimerDeadline && parsedSleepTimerDeadline > Date.now()) {
            setSleepTimer(savedSleepTimer);
            setSleepTimerDeadline(parsedSleepTimerDeadline);
        } else {
            window.localStorage.removeItem(SLEEP_TIMER_KEY);
            window.localStorage.removeItem(SLEEP_TIMER_DEADLINE_KEY);
        }

        try {
            const savedSessions = JSON.parse(window.localStorage.getItem(RECENT_BIBLE_SESSIONS_KEY) || '[]');
            if (Array.isArray(savedSessions)) {
                setRecentSessions(savedSessions);
            }
        } catch {
            setRecentSessions([]);
        }
    }, []);

    useEffect(() => {
        if (!chapterData) {
            return;
        }

        setSelectedVerse((current) => {
            if (chapterData.verses.some((verse) => verse.verse === current)) {
                return current;
            }
            return chapterData.verses[0]?.verse || 1;
        });
    }, [chapterData]);

    useEffect(() => {
        if (!chapterData || !queryVerse || Number.isNaN(queryVerse)) {
            return;
        }

        if (!chapterData.verses.some((verse) => verse.verse === queryVerse)) {
            return;
        }

        setSelectedVerse(queryVerse);
        setActiveVerse(queryVerse);

        const frame = window.requestAnimationFrame(() => {
            const verseElement = verseRefs.current[queryVerse];
            verseElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });

        return () => window.cancelAnimationFrame(frame);
    }, [chapterData, queryVerse]);

    useEffect(() => {
        if (typeof window === 'undefined' || !chapterData) {
            return;
        }

        const nextPath = buildBiblePath(chapterData.language, chapterData.book.id, chapterData.chapter);
        const verseForProgress = activeVerse || 1;
        window.localStorage.setItem(LAST_BIBLE_POSITION_KEY, nextPath);
        window.localStorage.setItem('atp_bible_progress', JSON.stringify({
            language: chapterData.language,
            bookId: chapterData.book.id,
            chapter: chapterData.chapter,
            verse: verseForProgress,
            playbackMode: audioSrc ? 'audio' : 'text',
            followAudio,
            playbackRate,
            updatedAt: new Date().toISOString(),
        }));
    }, [activeVerse, audioSrc, chapterData, followAudio, playbackRate]);

    function persistCurrentSession(overrideVerse?: number) {
        if (typeof window === 'undefined' || !chapterData || !audioSrc) {
            return;
        }

        const verse = overrideVerse || activeVerse || selectedVerse || 1;
        const entry: BibleSessionEntry = {
            id: `${chapterData.language}:${chapterData.book.id}:${chapterData.chapter}`,
            language: chapterData.language,
            bookId: chapterData.book.id,
            bookName: chapterData.book.name,
            chapter: chapterData.chapter,
            verse,
            updatedAt: new Date().toISOString(),
        };

        setRecentSessions((current) => {
            const nextSessions = upsertSessionEntry(current, entry);
            window.localStorage.setItem(RECENT_BIBLE_SESSIONS_KEY, JSON.stringify(nextSessions));
            return nextSessions;
        });
    }

    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }
        window.localStorage.setItem(PLAYBACK_RATE_KEY, String(playbackRate));
    }, [playbackRate]);

    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }
        window.localStorage.setItem(FOLLOW_AUDIO_KEY, followAudio ? '1' : '0');
    }, [followAudio]);

    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }

        if (!sleepTimer) {
            window.localStorage.removeItem(SLEEP_TIMER_KEY);
            window.localStorage.removeItem(SLEEP_TIMER_DEADLINE_KEY);
            return;
        }

        window.localStorage.setItem(SLEEP_TIMER_KEY, sleepTimer);

        if (sleepTimerDeadline) {
            window.localStorage.setItem(SLEEP_TIMER_DEADLINE_KEY, String(sleepTimerDeadline));
        } else {
            window.localStorage.removeItem(SLEEP_TIMER_DEADLINE_KEY);
        }
    }, [sleepTimer, sleepTimerDeadline]);

    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.playbackRate = playbackRate;
        }
    }, [playbackRate, audioSrc]);

    useEffect(() => {
        if (!followAudio || !activeVerse) {
            return;
        }

        scrollVerseIntoView(activeVerse, 'follow');
    }, [activeVerse, followAudio]);

    useEffect(() => {
        return () => {
            if (followScrollFrameRef.current !== null) {
                window.cancelAnimationFrame(followScrollFrameRef.current);
            }
        };
    }, []);

    useEffect(() => {
        if (sleepTimeoutRef.current) {
            clearTimeout(sleepTimeoutRef.current);
            sleepTimeoutRef.current = null;
        }

        if (!sleepTimer || sleepTimer === 'chapter') {
            return;
        }

        if (!sleepTimerDeadline) {
            return;
        }

        const remainingMs = sleepTimerDeadline - Date.now();
        if (remainingMs <= 0) {
            audioRef.current?.pause();
            setIsPlaying(false);
            setSleepTimer('');
            setSleepTimerDeadline(null);
            return;
        }

        sleepTimeoutRef.current = setTimeout(() => {
            audioRef.current?.pause();
            setIsPlaying(false);
            setSleepTimer('');
            setSleepTimerDeadline(null);
        }, remainingMs);

        return () => {
            if (sleepTimeoutRef.current) {
                clearTimeout(sleepTimeoutRef.current);
                sleepTimeoutRef.current = null;
            }
        };
    }, [sleepTimer, sleepTimerDeadline]);

    useEffect(() => {
        if (!audioSrc || !audioRef.current) {
            return;
        }

        audioRef.current.playbackRate = playbackRate;
        audioRef.current.load();
    }, [audioSrc, playbackRate]);

    useEffect(() => {
        if (!chapterData || !autoplay) {
            return;
        }

        const autoplayKey = `${chapterData.language}:${chapterData.book.id}:${chapterData.chapter}`;
        if (handledAutoplayKeyRef.current === autoplayKey) {
            return;
        }

        const firstPlayableVerse = chapterData.verses.find((verse) => verse.hasAudio && verse.audioPath);
        if (!firstPlayableVerse) {
            return;
        }

        handledAutoplayKeyRef.current = autoplayKey;
        pendingPlaybackRef.current = true;
        setActiveVerse(firstPlayableVerse.verse);
        setAudioSrc(firstPlayableVerse.audioPath);
    }, [autoplay, chapterData]);

    function registerVerseRef(verse: number, element: HTMLButtonElement | null) {
        verseRefs.current[verse] = element;
    }

    function animateWindowScroll(targetY: number, durationMs: number) {
        if (typeof window === 'undefined') {
            return;
        }

        if (followScrollFrameRef.current !== null) {
            window.cancelAnimationFrame(followScrollFrameRef.current);
        }

        const startY = window.scrollY;
        const maxY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
        const boundedTargetY = Math.max(0, Math.min(targetY, maxY));
        const deltaY = boundedTargetY - startY;

        if (Math.abs(deltaY) < 4) {
            window.scrollTo({ top: boundedTargetY });
            followScrollFrameRef.current = null;
            return;
        }

        const startTime = performance.now();

        const step = (currentTime: number) => {
            const progress = Math.min((currentTime - startTime) / durationMs, 1);
            const easedProgress = 1 - Math.pow(1 - progress, 3);
            window.scrollTo({ top: startY + deltaY * easedProgress });

            if (progress < 1) {
                followScrollFrameRef.current = window.requestAnimationFrame(step);
                return;
            }

            followScrollFrameRef.current = null;
        };

        followScrollFrameRef.current = window.requestAnimationFrame(step);
    }

    function scrollVerseIntoView(verseNumber: number, mode: 'direct' | 'follow') {
        const verseElement = verseRefs.current[verseNumber];
        if (!verseElement || typeof window === 'undefined') {
            return;
        }

        if (mode === 'direct') {
            verseElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }

        const viewportHeight = window.innerHeight;
        const rect = verseElement.getBoundingClientRect();
        const targetBottom = viewportHeight * 0.84;
        const deltaFromBottom = rect.bottom - targetBottom;

        if (deltaFromBottom <= 0) {
            return;
        }

        const durationMs = Math.min(1600, 1100 + Math.abs(deltaFromBottom) * 0.35);
        animateWindowScroll(window.scrollY + deltaFromBottom, durationMs);
    }

    function playVerse(verse: BibleVerse) {
        setSelectedVerse(verse.verse);
        if (!verse.hasAudio || !verse.audioPath) {
            setActiveVerse(verse.verse);
            return;
        }

        pendingPlaybackRef.current = true;
        setActiveVerse(verse.verse);
        setAudioSrc(verse.audioPath);
    }

    function handleAudioCanPlay() {
        if (!pendingPlaybackRef.current || !audioRef.current) {
            return;
        }

        pendingPlaybackRef.current = false;
        audioRef.current.play().catch((error) => {
            console.warn('Unable to start Bible audio playback:', error);
        });
    }

    function handleAudioPlay() {
        setIsPlaying(true);

        const verseToFocus = activeVerse ?? selectedVerse;
        if (!verseToFocus) {
            return;
        }

        scrollVerseIntoView(verseToFocus, 'direct');
    }

    function goToVerse(verseNumber: number) {
        setActiveVerse(verseNumber);
        scrollVerseIntoView(verseNumber, 'direct');
    }

    function playSelectedVerse() {
        if (!chapterData) {
            return;
        }

        const verse = chapterData.verses.find((entry) => entry.verse === selectedVerse);
        if (!verse) {
            return;
        }
        playVerse(verse);
    }

    function togglePlayback() {
        if (!audioRef.current) {
            return;
        }

        if (isPlaying) {
            audioRef.current.pause();
            return;
        }

        if (!audioSrc) {
            playSelectedVerse();
            return;
        }

        if (audioRef.current.readyState >= 2) {
            audioRef.current.play().catch((error) => {
                console.warn('Unable to resume Bible audio playback:', error);
            });
            return;
        }

        pendingPlaybackRef.current = true;
        audioRef.current.load();
    }

    function handleSleepTimerChange(value: string) {
        setSleepTimer(value);

        if (!value || value === 'chapter') {
            setSleepTimerDeadline(null);
            return;
        }

        const minutes = parseInt(value, 10);
        if (Number.isNaN(minutes) || minutes <= 0) {
            setSleepTimerDeadline(null);
            return;
        }

        setSleepTimerDeadline(Date.now() + minutes * 60 * 1000);
    }

    function playPreviousVerse() {
        if (!chapterData) {
            return;
        }

        const playableVerses = chapterData.verses.filter((verse) => verse.hasAudio && verse.audioPath);
        const currentVerse = activeVerse ?? selectedVerse;
        const currentIndex = playableVerses.findIndex((verse) => verse.verse === currentVerse);

        if (currentIndex <= 0) {
            return;
        }

        playVerse(playableVerses[currentIndex - 1]);
    }

    function scrollToPageTop() {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function handleBookChange(nextBookId: string) {
        if (!meta) {
            return;
        }

        const nextBook = meta.books.find((entry) => entry.bookId === nextBookId);
        if (!nextBook) {
            return;
        }

        router.push(buildBibleLocation(language || 'en', nextBookId, 1, { autoplay: isPlaying }));
    }

    function handleChapterChange(nextChapter: number) {
        if (!chapterData) {
            return;
        }
        router.push(buildBibleLocation(chapterData.language, chapterData.book.id, nextChapter, { autoplay: isPlaying }));
    }

    function handleSessionSelect(session: BibleSessionEntry) {
        router.push(buildBibleLocation(session.language, session.bookId, session.chapter, { verse: session.verse }));
        setSelectedVerse(session.verse);
    }

    function playNextVerseOrChapter() {
        if (!chapterData || activeVerse === null) {
            return;
        }

        const playableVerses = chapterData.verses.filter((verse) => verse.hasAudio && verse.audioPath);
        const currentIndex = playableVerses.findIndex((verse) => verse.verse === activeVerse);
        const nextVerse = currentIndex >= 0 ? playableVerses[currentIndex + 1] : null;

        if (nextVerse) {
            playVerse(nextVerse);
            return;
        }

        if (sleepTimer === 'chapter') {
            persistCurrentSession(activeVerse);
            setIsPlaying(false);
            return;
        }

        if (chapterData.navigation.nextChapter) {
            persistCurrentSession(activeVerse);
            const nextPath = buildBiblePath(
                chapterData.language,
                chapterData.navigation.nextChapter.bookId,
                chapterData.navigation.nextChapter.chapter
            );
            router.push(buildBibleLocation(
                chapterData.language,
                chapterData.navigation.nextChapter.bookId,
                chapterData.navigation.nextChapter.chapter,
                { autoplay: true },
            ));
            return;
        }

        persistCurrentSession(activeVerse);
        setIsPlaying(false);
    }

    if (isLoading) {
        return (
            <div className="container mx-auto px-4 py-10">
                <div className="animate-pulse space-y-4">
                    <div className="h-10 w-64 rounded-xl bg-scheme-c-bg/80" />
                    <div className="h-24 rounded-3xl bg-scheme-c-bg/70" />
                    <div className="h-24 rounded-3xl bg-scheme-c-bg/70" />
                    <div className="h-24 rounded-3xl bg-scheme-c-bg/70" />
                </div>
            </div>
        );
    }

    if (isError || !chapterData) {
        return (
            <div className="container mx-auto px-4 py-10">
                <div className="rounded-3xl border border-red-400/30 bg-red-900/10 p-8 text-center">
                    <h1 className="text-3xl font-bold text-red-100">Bible chapter unavailable</h1>
                    <p className="mt-3 text-red-100/80">The requested chapter could not be loaded.</p>
                    <Link href="/bible" className="mt-6 inline-flex rounded-full bg-primary px-6 py-3 font-semibold text-scheme-c-bg">
                        Back to Bible
                    </Link>
                </div>
            </div>
        );
    }

    const currentReferenceLabel = `${chapterData.book.name} ${chapterData.chapter}${activeVerse ? `:${activeVerse}` : ''}`;
    const playableVerses = chapterData.verses.filter((verse) => verse.hasAudio && verse.audioPath);
    const currentPlayableIndex = playableVerses.findIndex((verse) => verse.verse === (activeVerse ?? selectedVerse));
    const canGoPrevious = currentPlayableIndex > 0;
    const canGoNext = playableVerses.length > 0 && (currentPlayableIndex < playableVerses.length - 1 || Boolean(chapterData.navigation.nextChapter));
    const chapterNavigation = (
        <div className="flex items-center justify-center gap-3">
            {chapterData.navigation.previousChapter ? (
                <Link
                    href={buildBibleLocation(
                        chapterData.language,
                        chapterData.navigation.previousChapter.bookId,
                        chapterData.navigation.previousChapter.chapter,
                        { autoplay: isPlaying },
                    )}
                    aria-label="Previous chapter"
                    className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-primary/18 bg-scheme-c-bg/75 text-scheme-e-heading transition-colors hover:border-primary/45 hover:text-primary"
                >
                    <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4">
                        <path fill="currentColor" d="M12.78 4.97a.75.75 0 0 1 0 1.06L8.81 10l3.97 3.97a.75.75 0 1 1-1.06 1.06l-4.5-4.5a.75.75 0 0 1 0-1.06l4.5-4.5a.75.75 0 0 1 1.06 0Z" />
                    </svg>
                </Link>
            ) : null}
            <div className="rounded-full border border-primary/14 bg-scheme-c-bg/55 px-4 py-2 text-sm font-semibold text-scheme-e-heading/85">
                {chapterData.book.name} {chapterData.chapter}
            </div>
            {chapterData.navigation.nextChapter ? (
                <Link
                    href={buildBibleLocation(
                        chapterData.language,
                        chapterData.navigation.nextChapter.bookId,
                        chapterData.navigation.nextChapter.chapter,
                        { autoplay: isPlaying },
                    )}
                    aria-label="Next chapter"
                    className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-primary/18 bg-primary text-scheme-c-bg transition-opacity hover:opacity-90"
                >
                    <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4">
                        <path fill="currentColor" d="M7.22 4.97a.75.75 0 0 0 0 1.06L11.19 10l-3.97 3.97a.75.75 0 1 0 1.06 1.06l4.5-4.5a.75.75 0 0 0 0-1.06l-4.5-4.5a.75.75 0 0 0-1.06 0Z" />
                    </svg>
                </Link>
            ) : null}
        </div>
    );

    return (
        <>
            <Head>
                <title>{chapterData.book.name} {chapterData.chapter} - Bible - ALLthePREACHING</title>
                <meta name="description" content={`Read and listen to ${chapterData.book.name} chapter ${chapterData.chapter} in the KJV.`} />
            </Head>

            <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
                <section className="min-w-0">
                    {chapterData && meta ? (
                        <div className="mb-4 space-y-4">
                            <BibleNavigator
                                books={meta.books}
                                chapterData={chapterData}
                                selectedVerse={selectedVerse}
                                onBookChange={handleBookChange}
                                onChapterChange={handleChapterChange}
                                onVerseChange={setSelectedVerse}
                                onGoToVerse={() => goToVerse(selectedVerse)}
                                onPlaySelectedVerse={playSelectedVerse}
                            />
                            <BibleSessionHistory
                                sessions={recentSessions}
                                onSelectSession={handleSessionSelect}
                            />
                            <div className="flex justify-center">
                                {chapterNavigation}
                            </div>
                        </div>
                    ) : null}

                    <div className="rounded-[1.9rem] border border-primary/12 bg-scheme-c-bg/55 p-5 shadow-lg sm:p-6">
                        <div className="flex flex-col gap-4">
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                                <div>
                                    <div className="text-[11px] font-semibold uppercase tracking-[0.32em] text-primary/75">{chapterData.translationLabel} Bible</div>
                                    <div className="mt-2 flex flex-wrap items-center gap-2.5">
                                        <h1 className="text-3xl font-bold text-scheme-e-heading sm:text-4xl">{chapterData.book.name} {chapterData.chapter}</h1>
                                        <button
                                            type="button"
                                            onClick={() => setFollowAudio((current) => !current)}
                                            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors sm:text-sm ${followAudio
                                                ? 'border-primary bg-primary/10 text-primary'
                                                : 'border-primary/20 text-scheme-e-text/75 hover:border-primary/50 hover:text-primary'
                                                }`}
                                        >
                                            Follow audio
                                        </button>
                                        {isPlaying ? (
                                            <span className="rounded-full border border-primary/15 px-3 py-1.5 text-xs text-primary sm:text-sm">
                                                Playing {currentReferenceLabel}
                                            </span>
                                        ) : null}
                                    </div>
                                </div>
                            </div>

                            <BibleMiniPlayer
                                audioRef={audioRef}
                                audioSrc={audioSrc}
                                currentReferenceLabel={currentReferenceLabel}
                                onReferenceClick={scrollToPageTop}
                                isPlaying={isPlaying}
                                playbackRate={playbackRate}
                                onPlaybackRateChange={setPlaybackRate}
                                sleepTimer={sleepTimer}
                                onSleepTimerChange={handleSleepTimerChange}
                                onEnded={playNextVerseOrChapter}
                                onCanPlay={handleAudioCanPlay}
                                onPlay={handleAudioPlay}
                                onPause={() => {
                                    persistCurrentSession();
                                    setIsPlaying(false);
                                }}
                                onTogglePlayback={togglePlayback}
                                onPrevious={playPreviousVerse}
                                onNext={() => {
                                    if (activeVerse === null) {
                                        playSelectedVerse();
                                        return;
                                    }
                                    playNextVerseOrChapter();
                                }}
                                canGoPrevious={canGoPrevious}
                                canGoNext={canGoNext}
                            />
                        </div>
                    </div>

                    <div className="mt-4 sm:mt-5">
                        <VerseList
                            verses={chapterData.verses}
                            activeVerse={activeVerse}
                            onSelectVerse={playVerse}
                            registerVerseRef={registerVerseRef}
                        />
                    </div>

                    <div className="mt-4 flex justify-center sm:mt-6">
                        {chapterNavigation}
                    </div>
                </section>
            </div>
        </>
    );
}
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

function upsertSessionEntry(entries: BibleSessionEntry[], nextEntry: BibleSessionEntry) {
    const filtered = entries.filter((entry) => entry.id !== nextEntry.id);
    return [nextEntry, ...filtered].slice(0, 10);
}

function buildBiblePath(language: string, book: string, chapter: number | string) {
    return `/bible/${language}/${book}/${chapter}`;
}

export default function BibleChapterPage() {
    const router = useRouter();
    const language = typeof router.query.language === 'string' ? router.query.language : undefined;
    const book = typeof router.query.book === 'string' ? router.query.book : undefined;
    const chapter = typeof router.query.chapter === 'string' ? router.query.chapter : undefined;
    const autoplay = router.query.autoplay === '1';
    const { chapterData, isLoading, isError } = useBibleChapter(language, book, chapter);
    const { meta } = useBibleMeta(language);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const verseRefs = useRef<Record<number, HTMLButtonElement | null>>({});
    const sleepTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const handledAutoplayKeyRef = useRef<string | null>(null);
    const [activeVerse, setActiveVerse] = useState<number | null>(null);
    const [selectedVerse, setSelectedVerse] = useState(1);
    const [audioSrc, setAudioSrc] = useState<string | null>(null);
    const [playbackRate, setPlaybackRate] = useState(1);
    const [sleepTimer, setSleepTimer] = useState('');
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

    useEffect(() => {
        if (typeof window === 'undefined' || !chapterData || !activeVerse || !audioSrc) {
            return;
        }

        const entry: BibleSessionEntry = {
            id: `${chapterData.language}:${chapterData.book.id}:${chapterData.chapter}:${activeVerse}`,
            language: chapterData.language,
            bookId: chapterData.book.id,
            bookName: chapterData.book.name,
            chapter: chapterData.chapter,
            verse: activeVerse,
            updatedAt: new Date().toISOString(),
        };

        setRecentSessions((current) => {
            const nextSessions = upsertSessionEntry(current, entry);
            window.localStorage.setItem(RECENT_BIBLE_SESSIONS_KEY, JSON.stringify(nextSessions));
            return nextSessions;
        });
    }, [activeVerse, audioSrc, chapterData]);

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
        if (audioRef.current) {
            audioRef.current.playbackRate = playbackRate;
        }
    }, [playbackRate, audioSrc]);

    useEffect(() => {
        if (!followAudio || !activeVerse) {
            return;
        }

        const verseElement = verseRefs.current[activeVerse];
        verseElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, [activeVerse, followAudio]);

    useEffect(() => {
        if (sleepTimeoutRef.current) {
            clearTimeout(sleepTimeoutRef.current);
            sleepTimeoutRef.current = null;
        }

        if (!sleepTimer || sleepTimer === 'chapter') {
            return;
        }

        const minutes = parseInt(sleepTimer, 10);
        if (Number.isNaN(minutes) || minutes <= 0) {
            return;
        }

        sleepTimeoutRef.current = setTimeout(() => {
            audioRef.current?.pause();
            setIsPlaying(false);
        }, minutes * 60 * 1000);

        return () => {
            if (sleepTimeoutRef.current) {
                clearTimeout(sleepTimeoutRef.current);
                sleepTimeoutRef.current = null;
            }
        };
    }, [sleepTimer]);

    useEffect(() => {
        if (!audioSrc || !audioRef.current) {
            return;
        }

        audioRef.current.load();
        audioRef.current.playbackRate = playbackRate;
        audioRef.current.play().catch((error) => {
            console.warn('Unable to start Bible audio playback:', error);
        });
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
        setActiveVerse(firstPlayableVerse.verse);
        setAudioSrc(firstPlayableVerse.audioPath);
        router.replace(buildBiblePath(chapterData.language, chapterData.book.id, chapterData.chapter), undefined, { shallow: true });
    }, [autoplay, chapterData, router]);

    function registerVerseRef(verse: number, element: HTMLButtonElement | null) {
        verseRefs.current[verse] = element;
    }

    function playVerse(verse: BibleVerse) {
        setSelectedVerse(verse.verse);
        if (!verse.hasAudio || !verse.audioPath) {
            setActiveVerse(verse.verse);
            return;
        }

        setActiveVerse(verse.verse);
        setAudioSrc(verse.audioPath);
    }

    function goToVerse(verseNumber: number) {
        setActiveVerse(verseNumber);
        const verseElement = verseRefs.current[verseNumber];
        verseElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
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

    function handleBookChange(nextBookId: string) {
        if (!meta) {
            return;
        }

        const nextBook = meta.books.find((entry) => entry.bookId === nextBookId);
        if (!nextBook) {
            return;
        }

        router.push(buildBiblePath(language || 'en', nextBookId, 1));
    }

    function handleChapterChange(nextChapter: number) {
        if (!chapterData) {
            return;
        }
        router.push(buildBiblePath(chapterData.language, chapterData.book.id, nextChapter));
    }

    function handleSessionSelect(session: BibleSessionEntry) {
        router.push(buildBiblePath(session.language, session.bookId, session.chapter));
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
            setIsPlaying(false);
            return;
        }

        if (chapterData.navigation.nextChapter) {
            const nextPath = buildBiblePath(
                chapterData.language,
                chapterData.navigation.nextChapter.bookId,
                chapterData.navigation.nextChapter.chapter
            );
            router.push(`${nextPath}?autoplay=1`);
            return;
        }

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
                        </div>
                    ) : null}

                    <div className="rounded-[1.9rem] border border-primary/12 bg-scheme-c-bg/55 p-5 shadow-lg sm:p-6">
                        <div className="flex flex-col gap-4">
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                                <div>
                                    <div className="text-[11px] font-semibold uppercase tracking-[0.32em] text-primary/75">{chapterData.translationLabel} Bible</div>
                                    <h1 className="mt-2 text-3xl font-bold text-scheme-e-heading sm:text-4xl">{chapterData.book.name} {chapterData.chapter}</h1>
                                    <p className="mt-2 max-w-2xl text-sm leading-6 text-scheme-e-text/72 sm:text-base">
                                        A regular reading layout with tap-to-play verses, synced highlighting, and simple mobile-friendly playback controls.
                                    </p>
                                </div>

                                <div className="flex flex-wrap gap-2">
                                    {chapterData.navigation.previousChapter ? (
                                        <Link
                                            href={buildBiblePath(chapterData.language, chapterData.navigation.previousChapter.bookId, chapterData.navigation.previousChapter.chapter)}
                                            className="rounded-full border border-primary/20 px-4 py-2 text-sm font-semibold text-scheme-e-text transition-colors hover:border-primary hover:text-primary"
                                        >
                                            Previous
                                        </Link>
                                    ) : null}
                                    {chapterData.navigation.nextChapter ? (
                                        <Link
                                            href={buildBiblePath(chapterData.language, chapterData.navigation.nextChapter.bookId, chapterData.navigation.nextChapter.chapter)}
                                            className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-scheme-c-bg transition-opacity hover:opacity-90"
                                        >
                                            Next
                                        </Link>
                                    ) : null}
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
                                <button
                                    type="button"
                                    onClick={() => setFollowAudio((current) => !current)}
                                    className={`rounded-full border px-3 py-1.5 font-semibold transition-colors ${followAudio
                                        ? 'border-primary bg-primary/10 text-primary'
                                        : 'border-primary/20 text-scheme-e-text/75 hover:border-primary/50 hover:text-primary'
                                        }`}
                                >
                                    {followAudio ? 'Follow audio on' : 'Follow audio off'}
                                </button>

                                <span className="rounded-full border border-primary/15 px-3 py-1.5 text-scheme-e-text/75">
                                    {chapterData.verses.length} verses
                                </span>
                                <span className="rounded-full border border-primary/15 px-3 py-1.5 text-scheme-e-text/75">
                                    {chapterData.hasAudio ? 'Audio mapped for chapter' : 'Text only'}
                                </span>
                                {isPlaying ? (
                                    <span className="rounded-full border border-primary/15 px-3 py-1.5 text-primary">
                                        Playing {currentReferenceLabel}
                                    </span>
                                ) : null}
                            </div>

                            <BibleMiniPlayer
                                audioRef={audioRef}
                                audioSrc={audioSrc}
                                currentReferenceLabel={currentReferenceLabel}
                                playbackRate={playbackRate}
                                onPlaybackRateChange={setPlaybackRate}
                                sleepTimer={sleepTimer}
                                onSleepTimerChange={setSleepTimer}
                                onEnded={playNextVerseOrChapter}
                                onPlay={() => setIsPlaying(true)}
                                onPause={() => setIsPlaying(false)}
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
                </section>
            </div>
        </>
    );
}
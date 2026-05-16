/**
 * Video detail page
 * Show video player, metadata, and recommendations
 */
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { useState, useEffect, useMemo, useRef } from 'react';
import { useVideo, useRecommendations } from '@/hooks/useApi';
import VideoPlayer from '@/components/VideoPlayer';
import { resolveMediaUrl } from '@/lib/media';
import config from '@/config';
import api from '@/lib/api';

const formatDuration = (minutes?: number | null) => {
    if (!minutes && minutes !== 0) {
        return null;
    }

    const totalMinutes = Math.round(minutes);
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
};

const RecommendedVideoCard = ({ video }: { video: any }) => {
    const fallbackThumbnail = '/images/placeholder.png';
    const thumbnail = resolveMediaUrl(video.thumbnail_stream_url || video.thumb_url) || fallbackThumbnail;
    const durationLabel = formatDuration(video.runtime_minutes);

    return (
        <Link
            href={`/video/${video.id}`}
            className="flex gap-3 rounded-xl border border-secondary-dark/40 bg-scheme-b-bg/40 hover:bg-scheme-b-bg/70 transition-colors p-3 shadow-sm"
        >
            <div className="relative flex-shrink-0 w-32 sm:w-36 aspect-video rounded-lg overflow-hidden bg-scheme-c-bg/40">
                <img
                    src={thumbnail}
                    alt={video.vid_title || video.name}
                    loading="lazy"
                    decoding="async"
                    onError={(event) => {
                        event.currentTarget.src = fallbackThumbnail;
                    }}
                    className="absolute inset-0 h-full w-full object-cover"
                />
                {durationLabel && (
                    <span className="absolute bottom-1 right-1 text-[11px] px-1.5 py-0.5 rounded bg-scheme-e-bg/90 text-primary font-semibold">
                        {durationLabel}
                    </span>
                )}
            </div>

            <div className="flex flex-col text-sm gap-1 text-scheme-c-text/90">
                <p className="font-semibold leading-snug line-clamp-2">{video.vid_title || video.name}</p>
                <span className="text-xs text-secondary-light/80">{video.vid_preacher}</span>
                <span className="text-xs text-secondary-light/70">{new Date(video.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                {video.clicks > 0 && (
                    <span className="text-xs text-secondary-light/70">{video.clicks.toLocaleString()} views</span>
                )}
            </div>
        </Link>
    );
};

export default function VideoPage() {
    const router = useRouter();
    const { id } = router.query;
    const seekParam = typeof router.query.t === 'string' ? parseFloat(router.query.t) : null;
    const { video, isLoading, isError } = useVideo(id as string);
    const { recommendations } = useRecommendations(id as string, 8);
    const [currentTime, setCurrentTime] = useState(0);
    const currentTimeRef = useRef(0);
    const [resumeTime, setResumeTime] = useState<number | null>(null);
    const [showAudioMode, setShowAudioMode] = useState(false);
    const audioRef = useRef<HTMLAudioElement>(null);

    // Inline subtitle search within this video
    const [subtitleSearchQuery, setSubtitleSearchQuery] = useState('');
    const [subtitleSearchResults, setSubtitleSearchResults] = useState<{ timestamp: string; text: string; cueIndex: number }[]>([]);
    const [subtitleSearchLoading, setSubtitleSearchLoading] = useState(false);

    useEffect(() => {
        const trimmed = subtitleSearchQuery.trim();
        if (!trimmed || !video?.id) {
            setSubtitleSearchResults([]);
            return;
        }
        const timer = setTimeout(async () => {
            setSubtitleSearchLoading(true);
            try {
                const data = await api.search({
                    query: trimmed,
                    videoId: video.id,
                    mode: 'subtitles',
                    limit: 200,
                }) as any;
                setSubtitleSearchResults(
                    (data.results || []).map((r: any) => ({
                        timestamp: String(r.timestamp),
                        text: r.text,
                        cueIndex: r.cueIndex,
                    }))
                );
            } catch {
                setSubtitleSearchResults([]);
            } finally {
                setSubtitleSearchLoading(false);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [subtitleSearchQuery, video?.id]);

    const handleTimeUpdate = (time: number) => {
        setCurrentTime(time);
        currentTimeRef.current = time;
    };

    // Save progress to localStorage every 5 seconds
    useEffect(() => {
        if (!id) return;

        const interval = setInterval(() => {
            const value = currentTimeRef.current;
            if (value > 0) {
                localStorage.setItem(`video_${id}_progress`, value.toString());
            }
        }, 5000);

        return () => clearInterval(interval);
    }, [id]);

    // Load saved progress
    const getSavedProgress = () => {
        if (id) {
            const saved = localStorage.getItem(`video_${id}_progress`);
            return saved ? parseFloat(saved) : 0;
        }
        return 0;
    };

    const savedProgress = useMemo(() => getSavedProgress(), [id]);
    const startAt = seekParam && !Number.isNaN(seekParam) ? seekParam : savedProgress;
    const resumeStartTime = resumeTime && resumeTime > 0 ? resumeTime : startAt;

    useEffect(() => {
        if (!showAudioMode || !audioRef.current) {
            return;
        }

        const audioElement = audioRef.current;

        const applyProgress = () => {
            if (resumeStartTime > 0) {
                audioElement.currentTime = resumeStartTime;
            }
        };

        if (audioElement.readyState >= 1) {
            applyProgress();
            return;
        }

        audioElement.addEventListener('loadedmetadata', applyProgress);

        return () => {
            audioElement.removeEventListener('loadedmetadata', applyProgress);
        };
    }, [showAudioMode, resumeStartTime]);

    const videoSrc = resolveMediaUrl(video?.stream_url || video?.vid_url);
    const posterSrc = resolveMediaUrl(video?.thumbnail_stream_url || video?.thumb_url) || '/images/placeholder.png';
    const audioSrc = resolveMediaUrl(video?.audio_stream_url || video?.audio_url) || videoSrc;
    // Prefer loading subtitles via backend proxy to avoid CORS issues from the provider.
    const subtitleSrc = id && (video?.subtitles_stream_url || video?.subtitles_url)
        ? `${config.api.baseUrl}/api/videos/${id}/subtitles`
        : resolveMediaUrl(video?.subtitles_stream_url || video?.subtitles_url);
    const getDownloadName = (url?: string, fallback?: string) => {
        if (!url) return fallback || 'download';
        try {
            const parsed = new URL(url);
            const name = parsed.pathname.split('/').pop();
            return name ? decodeURIComponent(name) : fallback || 'download';
        } catch {
            const clean = url.split('?')[0];
            const name = clean.split('/').pop();
            return name ? decodeURIComponent(name) : fallback || 'download';
        }
    };
    const videoDownloadName = getDownloadName(video?.vid_url, `video_${id}.mp4`);
    const audioDownloadName = getDownloadName(video?.audio_url || (video?.vid_url ? `${video.vid_url.replace(/\.mp4($|\?)/, '.mp3$1')}` : ''), `audio_${id}.mp3`);
    const transcriptDownloadName = getDownloadName(video?.subtitles_url || video?.subtitle_url || (video?.vid_url ? `${video.vid_url.replace(/\.mp4($|\?)/, '.vtt$1')}` : ''), `transcript_${id}.vtt`);
    const subtitleTracks = useMemo(() => subtitleSrc ? [{
        kind: 'captions',
        label: 'English',
        src: subtitleSrc,
        srclang: 'en',
        default: true,
    }] : [], [subtitleSrc]);
    const runtimeLabel = formatDuration(video?.runtime_minutes);
    const displayCategory = video?.search_category || video?.vid_category;
    const matchCategory = video?.vid_category;

    if (isLoading) {
        return (
            <div className="container mx-auto px-4 py-8">
                <div className="animate-pulse">
                    <div className="aspect-video bg-gray-300 dark:bg-gray-600 rounded-lg mb-4"></div>
                    <div className="h-8 bg-gray-300 dark:bg-gray-600 rounded w-3/4 mb-4"></div>
                    <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-1/2"></div>
                </div>
            </div>
        );
    }

    if (isError || !video) {
        return (
            <div className="container mx-auto px-4 py-8 text-center">
                <h1 className="text-2xl font-bold mb-4">Video not found</h1>
                <Link href="/" className="btn-primary">
                    Return to Home
                </Link>
            </div>
        );
    }

    return (
        <>
            <Head>
                <title>{video.vid_title || video.name} - ALLthePREACHING</title>
                <meta name="description" content={`Sermon by ${video.vid_preacher}`} />
            </Head>

            <div className="container mx-auto px-4 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Main Content */}
                    <div className="lg:col-span-2">
                        {/* Video Player */}
                        <div className="mb-4">
                            {!showAudioMode ? (
                                videoSrc ? (
                                    <VideoPlayer
                                        src={videoSrc}
                                        poster={posterSrc}
                                        mediaTitle={video.vid_title || video.name}
                                        mediaArtist={video.vid_preacher}
                                        startTime={resumeStartTime}
                                        onTimeUpdate={handleTimeUpdate}
                                        portrait={false}
                                        tracks={subtitleTracks}
                                    />
                                ) : (
                                    <div className="aspect-video flex items-center justify-center rounded-lg border border-red-400/40 bg-red-900/10 text-red-200">
                                        Video stream unavailable.
                                    </div>
                                )
                            ) : (
                                audioSrc ? (
                                    <div className="bg-scheme-c-bg border border-primary/30 rounded-lg p-6">
                                        <audio
                                            ref={audioRef}
                                            controls
                                            className="w-full"
                                            src={audioSrc}
                                            onTimeUpdate={(event) => handleTimeUpdate(event.currentTarget.currentTime)}
                                        >
                                            Your browser does not support the audio element.
                                        </audio>
                                        <p className="mt-3 text-sm text-primary/80 flex items-center gap-2">
                                            <span className="inline-flex h-2 w-2 rounded-full bg-primary animate-pulse" />
                                            Audio mode streaming via ALLthePREACHING backend
                                        </p>
                                    </div>
                                ) : (
                                    <div className="aspect-video flex items-center justify-center rounded-lg border border-yellow-400/40 bg-yellow-900/10 text-yellow-200">
                                        Audio track unavailable for this sermon.
                                    </div>
                                )
                            )}
                        </div>

                        {/* Controls */}
                        <div className="mb-4 flex flex-wrap gap-2">
                            <button
                                onClick={() => {
                                    const nextTime = currentTimeRef.current || currentTime;
                                    if (nextTime > 0) {
                                        setResumeTime(nextTime);
                                    }
                                    setShowAudioMode(!showAudioMode);
                                }}
                                className="btn-secondary w-full sm:w-auto text-xs sm:text-sm px-4 py-2 sm:px-5 sm:py-2 rounded-full sm:rounded-lg flex items-center justify-center text-center gap-2"
                            >
                                {showAudioMode ? '📹 Video Mode' : (
                                    <>
                                        <svg width="1em" height="1em" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512" fill="currentColor"><path d="M381.9 388.2c-6.4 27.4-27.2 42.8-55.1 48-24.5 4.5-44.9 5.6-64.5-10.2-23.9-20.1-24.2-53.4-2.7-74.4 17-16.2 40.9-19.5 76.8-25.8 6-1.1 11.2-2.5 15.6-7.4 6.4-7.2 4.4-4.1 4.4-163.2 0-11.2-5.5-14.3-17-12.3-8.2 1.4-185.7 34.6-185.7 34.6-10.2 2.2-13.4 5.2-13.4 16.7 0 234.7 1.1 223.9-2.5 239.5-4.2 18.2-15.4 31.9-30.2 39.5-16.8 9.3-47.2 13.4-63.4 10.4-43.2-8.1-58.4-58-29.1-86.6 17-16.2 40.9-19.5 76.8-25.8 6-1.1 11.2-2.5 15.6-7.4 10.1-11.5 1.8-256.6 5.2-270.2 .8-5.2 3-9.6 7.1-12.9 4.2-3.5 11.8-5.5 13.4-5.5 204-38.2 228.9-43.1 232.4-43.1 11.5-.8 18.1 6 18.1 17.6 .2 344.5 1.1 326-1.8 338.5z" /></svg>
                                        Audio Mode
                                    </>
                                )}
                            </button>
                        </div>

                        {/* Video Info */}
                        <div className="mb-6">
                            <h1 className="text-2xl md:text-3xl font-bold">
                                {video.vid_title || video.name}
                            </h1>

                            <div className="flex flex-wrap items-center gap-4 text-secondary-light mb-4">
                                <Link
                                    href={`/preacher/${video.vid_preacher}`}
                                    className="font-semibold hover:text-primary-600 dark:hover:text-primary-400"
                                >
                                    {video.vid_preacher}
                                </Link>
                                <span>•</span>
                                <span>{new Date(video.date).toLocaleDateString()}</span>
                                {video.clicks > 0 && (
                                    <>
                                        <span>•</span>
                                        <span>{video.clicks.toLocaleString()} views</span>
                                    </>
                                )}
                                {runtimeLabel && (
                                    <>
                                        <span>•</span>
                                        <span>{runtimeLabel}</span>
                                    </>
                                )}
                            </div>

                            {displayCategory && matchCategory && (
                                <div className="flex gap-2 flex-wrap">
                                    <Link
                                        href={`/category/${matchCategory}`}
                                        className="px-3 py-1 bg-primary-100 dark:bg-primary-900 text-primary-800 dark:text-primary-200 rounded-full text-sm"
                                    >
                                        {displayCategory}
                                    </Link>
                                </div>
                            )}

                            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                                {videoSrc && (
                                    <a
                                        href={video?.stream_url || video?.vid_url}
                                        download={videoDownloadName}
                                        className="btn-secondary w-full sm:w-auto text-xs sm:text-xs px-4 py-2 sm:px-3 sm:py-1.5 rounded-full sm:rounded-lg inline-flex items-center justify-center text-center"
                                    >
                                        Download video
                                    </a>
                                )}
                                {audioSrc && (
                                    <a
                                        href={video?.audio_stream_url || video?.audio_url || video?.vid_url}
                                        download={audioDownloadName}
                                        className="btn-secondary w-full sm:w-auto text-xs sm:text-xs px-4 py-2 sm:px-3 sm:py-1.5 rounded-full sm:rounded-lg inline-flex items-center justify-center text-center"
                                    >
                                        Download audio
                                    </a>
                                )}
                                {subtitleSrc && (
                                    <a
                                        href={`${config.api.baseUrl}/api/videos/${id}/subtitles?download=1`}
                                        download={transcriptDownloadName}
                                        className="btn-secondary w-full sm:w-auto text-xs sm:text-xs px-4 py-2 sm:px-3 sm:py-1.5 rounded-full sm:rounded-lg inline-flex items-center justify-center text-center"
                                    >
                                        Download transcript
                                    </a>
                                )}
                            </div>
                        </div>

                        {/* Inline subtitle search */}
                        {subtitleSrc && (
                            <div className="mt-6 rounded-xl border border-secondary-dark/40 bg-scheme-b-bg/40 p-4">
                                <h3 className="text-sm font-semibold text-scheme-e-heading mb-3 flex items-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                                    Search in this sermon
                                </h3>
                                <input
                                    type="search"
                                    placeholder="Search transcript…"
                                    value={subtitleSearchQuery}
                                    onChange={e => setSubtitleSearchQuery(e.target.value)}
                                    className="w-full rounded-lg border border-secondary-dark/60 bg-scheme-c-bg/60 px-3 py-2 text-sm
                                               text-scheme-e-text placeholder:text-scheme-e-text/40
                                               focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/40"
                                />
                                {subtitleSearchLoading && (
                                    <p className="mt-2 text-xs text-scheme-e-text/50">Searching…</p>
                                )}
                                {!subtitleSearchLoading && subtitleSearchResults.length > 0 && (
                                    <div className="mt-3 max-h-72 overflow-y-auto space-y-1 pr-1">
                                        {subtitleSearchResults.map((hit, i) => {
                                            const secs = Math.max(0, Math.floor(parseFloat(hit.timestamp)) - 3);
                                            const label = (() => {
                                                const total = Math.floor(parseFloat(hit.timestamp));
                                                const h = Math.floor(total / 3600);
                                                const m = Math.floor((total % 3600) / 60);
                                                const s = total % 60;
                                                const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
                                                const ss = String(s).padStart(2, '0');
                                                return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
                                            })();
                                            return (
                                                <button
                                                    key={`${hit.cueIndex}-${i}`}
                                                    type="button"
                                                    onClick={() => {
                                                        setResumeTime(secs);
                                                        // Update URL so VideoPlayer seeks on next load if needed
                                                        router.replace(
                                                            { pathname: router.pathname, query: { ...router.query, t: secs } },
                                                            undefined,
                                                            { shallow: true, scroll: false }
                                                        );
                                                    }}
                                                    className="w-full text-left rounded-lg border border-secondary-dark/30 bg-scheme-c-bg/40
                                                               px-3 py-2 hover:border-primary/60 hover:bg-scheme-c-bg/70 transition-all"
                                                >
                                                    <span className="text-xs font-semibold text-primary mr-2">{label}</span>
                                                    <span className="text-sm text-scheme-e-text/80">{hit.text}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                                {!subtitleSearchLoading && subtitleSearchQuery.trim() && subtitleSearchResults.length === 0 && (
                                    <p className="mt-2 text-xs text-scheme-e-text/50">No matches found.</p>
                                )}
                                {subtitleSearchResults.length > 0 && (
                                    <p className="mt-2 text-xs text-scheme-e-text/40">{subtitleSearchResults.length} match{subtitleSearchResults.length !== 1 ? 'es' : ''} — click to jump</p>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Sidebar - Recommendations */}
                    <div className="lg:col-span-1">
                        <h2 className="text-xl font-bold mb-4">More from {video.vid_preacher}</h2>
                        <div className="space-y-3">
                            {recommendations.map((rec: any) => (
                                <RecommendedVideoCard key={rec.id} video={rec} />
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}

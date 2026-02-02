/**
 * Video detail page
 * Show video player, metadata, and recommendations
 */
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect, useMemo, useRef } from 'react';
import { useVideo, useRecommendations } from '@/hooks/useApi';
import VideoPlayer from '@/components/VideoPlayer';
import { resolveMediaUrl } from '@/lib/media';
import config from '@/config';

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
    const thumbnail = resolveMediaUrl(video.thumbnail_stream_url || video.thumb_url);
    const durationLabel = formatDuration(video.runtime_minutes);

    return (
        <Link
            href={`/video/${video.id}`}
            className="flex gap-3 rounded-xl border border-secondary-dark/40 bg-scheme-b-bg/40 hover:bg-scheme-b-bg/70 transition-colors p-3 shadow-sm"
        >
            <div className="relative flex-shrink-0 w-32 sm:w-36 aspect-video rounded-lg overflow-hidden bg-scheme-c-bg/40">
                {thumbnail ? (
                    <Image
                        src={thumbnail}
                        alt={video.vid_title || video.name}
                        fill
                        sizes="(max-width: 1024px) 160px, 180px"
                        className="object-cover"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-secondary-light/60">
                        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M10 8v8l6-4-6-4z" />
                        </svg>
                    </div>
                )}
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
    const [showAudioMode, setShowAudioMode] = useState(false);
    const audioRef = useRef<HTMLAudioElement>(null);

    // Save progress to localStorage
    useEffect(() => {
        if (id && currentTime > 0) {
            localStorage.setItem(`video_${id}_progress`, currentTime.toString());
        }
    }, [id, currentTime]);

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

    useEffect(() => {
        if (!showAudioMode || !audioRef.current) {
            return;
        }

        const audioElement = audioRef.current;

        const applyProgress = () => {
            if (startAt > 0) {
                audioElement.currentTime = startAt;
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
    }, [showAudioMode, savedProgress]);

    const videoSrc = resolveMediaUrl(video?.stream_url || video?.vid_url);
    const posterSrc = resolveMediaUrl(video?.thumbnail_stream_url || video?.thumb_url);
    const audioSrc = resolveMediaUrl(video?.audio_stream_url || video?.audio_url) || videoSrc;
    const subtitleSrc = resolveMediaUrl(video?.subtitles_stream_url || video?.subtitles_url);
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
                                        startTime={startAt}
                                        onTimeUpdate={setCurrentTime}
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
                                            onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
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
                        <div className="flex flex-wrap gap-2 mb-4">
                            <button
                                onClick={() => setShowAudioMode(!showAudioMode)}
                                className="btn-secondary text-sm"
                            >
                                {showAudioMode ? '📹 Video Mode' : '🎵 Audio Mode'}
                            </button>
                            {videoSrc && (
                                <a
                                    href={`${config.api.baseUrl}/api/videos/${id}/video?download=1`}
                                    download={videoDownloadName}
                                    className="btn-secondary text-sm"
                                >
                                    Download video
                                </a>
                            )}
                            {audioSrc && (
                                <a
                                    href={`${config.api.baseUrl}/api/videos/${id}/audio?download=1`}
                                    download={audioDownloadName}
                                    className="btn-secondary text-sm"
                                >
                                    Download audio
                                </a>
                            )}
                            {subtitleSrc && (
                                <a
                                    href={`${config.api.baseUrl}/api/videos/${id}/subtitles?download=1`}
                                    download={transcriptDownloadName}
                                    className="btn-secondary text-sm"
                                >
                                    Download transcript
                                </a>
                            )}
                        </div>

                        {/* Video Info */}
                        <div className="mb-6">
                            <h1 className="text-2xl md:text-3xl font-bold mb-2">
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
                        </div>
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

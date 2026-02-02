/**
 * Video detail page
 * Show video player, metadata, and recommendations
 */
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { useVideo, useRecommendations } from '@/hooks/useApi';
import VideoPlayer from '@/components/VideoPlayer';
import VideoCard from '@/components/VideoCard';
import { useState, useEffect } from 'react';

export default function VideoPage() {
    const router = useRouter();
    const { id } = router.query;
    const { video, isLoading, isError } = useVideo(id as string);
    const { recommendations } = useRecommendations(id as string, 8);
    const [currentTime, setCurrentTime] = useState(0);
    const [showAudioMode, setShowAudioMode] = useState(false);

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
                                <VideoPlayer
                                    src={video.vid_url}
                                    poster={video.thumb_url}
                                    startTime={getSavedProgress()}
                                    onTimeUpdate={setCurrentTime}
                                    portrait={false}
                                />
                            ) : (
                                <div className="aspect-video bg-gradient-to-br from-primary-800 to-primary-600 rounded-lg flex items-center justify-center">
                                    <div className="text-center text-white">
                                        <svg className="w-24 h-24 mx-auto mb-4" fill="currentColor" viewBox="0 0 20 20">
                                            <path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z" />
                                        </svg>
                                        <h3 className="text-2xl font-bold">Audio Mode</h3>
                                        <p className="mt-2">Playing audio only</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Controls */}
                        <div className="flex gap-2 mb-4">
                            <button
                                onClick={() => setShowAudioMode(!showAudioMode)}
                                className="btn-secondary text-sm"
                            >
                                {showAudioMode ? '📹 Video Mode' : '🎵 Audio Mode'}
                            </button>
                        </div>

                        {/* Video Info */}
                        <div className="mb-6">
                            <h1 className="text-2xl md:text-3xl font-bold mb-2">
                                {video.vid_title || video.name}
                            </h1>

                            <div className="flex flex-wrap items-center gap-4 text-gray-600 dark:text-gray-400 mb-4">
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
                                {video.runtime_minutes && (
                                    <>
                                        <span>•</span>
                                        <span>{Math.floor(video.runtime_minutes / 60)}h {video.runtime_minutes % 60}m</span>
                                    </>
                                )}
                            </div>

                            {video.vid_category && (
                                <div className="flex gap-2 flex-wrap">
                                    <Link
                                        href={`/category/${video.vid_category}`}
                                        className="px-3 py-1 bg-primary-100 dark:bg-primary-900 text-primary-800 dark:text-primary-200 rounded-full text-sm"
                                    >
                                        {video.vid_category}
                                    </Link>
                                    {video.search_category && video.search_category !== video.vid_category && (
                                        <Link
                                            href={`/category/${video.search_category}`}
                                            className="px-3 py-1 bg-gray-200 dark:bg-gray-700 rounded-full text-sm"
                                        >
                                            {video.search_category}
                                        </Link>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Sidebar - Recommendations */}
                    <div className="lg:col-span-1">
                        <h2 className="text-xl font-bold mb-4">More from {video.vid_preacher}</h2>
                        <div className="space-y-4">
                            {recommendations.map((rec: any) => (
                                <VideoCard
                                    key={rec.id}
                                    id={rec.id}
                                    title={rec.vid_title || rec.name}
                                    preacher={rec.vid_preacher}
                                    date={rec.date}
                                    thumbnail={rec.thumb_url}
                                    views={rec.clicks}
                                    duration={rec.runtime_minutes}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}

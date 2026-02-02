/**
 * Preacher-specific page
 * Shows all videos for a single preacher
 */
import { useRouter } from 'next/router';
import Head from 'next/head';
import { usePreacher, useVideos } from '@/hooks/useApi';
import VideoCard from '@/components/VideoCard';
import { useMemo, useState } from 'react';

interface Preacher {
    name: string;
    videoCount: number;
    totalViews?: number;
    latestVideo?: string;
    firstVideo?: string;
}

export default function PreacherPage() {
    const router = useRouter();
    const { slug } = router.query;
    const { preacher, isLoading: preacherLoading } = usePreacher(slug as string);
    const [page, setPage] = useState(1);
    const PAGE_SIZES = [24, 48, 96];
    const [pageSize, setPageSize] = useState(PAGE_SIZES[0]);
    const [lengthFilter, setLengthFilter] = useState<'all' | 'long' | 'short'>('all');
    const { videos, pagination, isLoading: videosLoading } = useVideos({
        preacher: slug as string,
        page: page.toString(),
        limit: pageSize.toString(),
        sort: 'date'
    });

    const filteredVideos = useMemo(() => {
        if (lengthFilter === 'all') return videos;
        return videos.filter((video: any) => {
            const minutes = Number(video.runtime_minutes);
            if (Number.isNaN(minutes)) return false;
            return lengthFilter === 'long' ? minutes >= 20 : minutes < 20;
        });
    }, [videos, lengthFilter]);

    if (preacherLoading || videosLoading) {
        return (
            <div className="container mx-auto px-4 py-8">
                <div className="animate-pulse">
                    <div className="h-12 bg-gray-300 dark:bg-gray-600 rounded w-1/3 mb-4"></div>
                    <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-1/2 mb-8"></div>
                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
                        {[...Array(pageSize)].map((_, i) => (
                            <div key={i} className="card">
                                <div className="aspect-video bg-gray-300 dark:bg-gray-600 rounded-lg mb-3"></div>
                                <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded mb-2"></div>
                                <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-2/3"></div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    if (!preacher) {
        return (
            <div className="container mx-auto px-4 py-8 text-center">
                <h1 className="text-2xl font-bold mb-4">Preacher not found</h1>
            </div>
        );
    }

    return (
        <>
            <Head>
                <title>{preacher.name} - ALLthePREACHING</title>
                <meta name="description" content={`Sermons by ${preacher.name}`} />
            </Head>

            <div className="container mx-auto px-4 py-8">
                {/* Preacher Header */}
                <div className="mb-8">
                    <h1 className="text-4xl font-bold mb-4">{preacher.name}</h1>
                    <div className="flex flex-wrap gap-6 text-gray-600 dark:text-gray-400">
                        <div>
                            <span className="font-semibold">{preacher.videoCount}</span> sermons
                        </div>
                        <div>
                            <span className="font-semibold">{preacher.totalViews?.toLocaleString() || 0}</span> total views
                        </div>
                        {preacher.latestVideo && (
                            <div>
                                Latest: <span className="font-semibold">{new Date(preacher.latestVideo).toLocaleDateString()}</span>
                            </div>
                        )}
                    </div>

                    {/* RSS Feed Link */}
                    <div className="mt-4">
                        <a
                            href={`${process.env.NEXT_PUBLIC_API_URL}/api/rss/preacher/${slug}`}
                            className="inline-flex items-center gap-2 text-primary-600 hover:text-primary-700 dark:text-primary-400"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M5 3a1 1 0 000 2c5.523 0 10 4.477 10 10a1 1 0 102 0C17 8.373 11.627 3 5 3z" />
                                <path d="M4 9a1 1 0 011-1 7 7 0 017 7 1 1 0 11-2 0 5 5 0 00-5-5 1 1 0 01-1-1zM3 15a2 2 0 114 0 2 2 0 01-4 0z" />
                            </svg>
                            Subscribe via RSS
                        </a>
                    </div>
                </div>

                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-6">
                    <h2 className="text-2xl font-semibold">Sermons</h2>
                    <div className="flex flex-wrap items-center gap-3 text-sm">
                        <div className="flex items-center gap-2">
                            <span className="text-gray-600 dark:text-gray-400">Show only:</span>
                            <div className="flex rounded-full border border-secondary-dark/40 overflow-hidden">
                                <button
                                    onClick={() => setLengthFilter('all')}
                                    className={`px-4 py-1 font-semibold transition-colors ${lengthFilter === 'all'
                                        ? 'bg-primary text-scheme-c-bg'
                                        : 'text-secondary-light hover:bg-scheme-b-bg/60'
                                        }`}
                                >
                                    All
                                </button>
                                <button
                                    onClick={() => setLengthFilter('long')}
                                    className={`px-4 py-1 font-semibold transition-colors ${lengthFilter === 'long'
                                        ? 'bg-primary text-scheme-c-bg'
                                        : 'text-secondary-light hover:bg-scheme-b-bg/60'
                                        }`}
                                >
                                    Long (20m+)
                                </button>
                                <button
                                    onClick={() => setLengthFilter('short')}
                                    className={`px-4 py-1 font-semibold transition-colors ${lengthFilter === 'short'
                                        ? 'bg-primary text-scheme-c-bg'
                                        : 'text-secondary-light hover:bg-scheme-b-bg/60'
                                        }`}
                                >
                                    Short (&lt;20m)
                                </button>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-gray-600 dark:text-gray-400">Per page:</span>
                            <div className="flex rounded-full border border-secondary-dark/40 overflow-hidden">
                                {PAGE_SIZES.map(size => (
                                    <button
                                        key={size}
                                        onClick={() => { setPageSize(size); setPage(1); }}
                                        className={`px-4 py-1 font-semibold transition-colors ${pageSize === size
                                            ? 'bg-primary text-scheme-c-bg'
                                            : 'text-secondary-light hover:bg-scheme-b-bg/60'
                                            }`}
                                    >
                                        {size}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Videos Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
                    {filteredVideos.map((video: any) => (
                        <VideoCard
                            key={video.id}
                            id={video.id}
                            title={video.vid_title || video.name}
                            preacher={video.vid_preacher}
                            date={video.date}
                            thumbnail={video.thumbnail_stream_url || video.thumb_url}
                            views={video.clicks}
                            duration={video.runtime_minutes}
                            categoryName={video.search_category}
                            categorySlug={video.vid_category}
                        />
                    ))}
                </div>

                {/* Pagination */}
                {pagination && pagination.totalPages > 1 && (
                    <div className="flex justify-center gap-2">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            ← Previous
                        </button>
                        <span className="px-4 py-2">
                            Page {pagination.page} of {pagination.totalPages}
                        </span>
                        <button
                            onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                            disabled={page === pagination.totalPages}
                            className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Next →
                        </button>
                    </div>
                )}
            </div>
        </>
    );
}

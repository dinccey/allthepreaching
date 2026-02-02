/**
 * Latest/New Content Page
 * Displays most recent video uploads with compact cards
 */
import Head from 'next/head';
import { useVideos } from '@/hooks/useApi';
import { useState } from 'react';
import VideoCard from '@/components/VideoCard';

export default function LatestPage() {
    const PAGE_SIZES = [25, 50, 100];
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(PAGE_SIZES[0]);
    const { videos, pagination, isLoading } = useVideos({
        page: page.toString(),
        limit: pageSize.toString(),
        sort: 'date'
    });

    return (
        <>
            <Head>
                <title>Latest Content - ALLthePREACHING</title>
                <meta name="description" content="Latest sermon uploads on ALLthePREACHING" />
            </Head>

            <div className="container mx-auto px-4 py-8">
                <h1 className="text-4xl font-bold mb-2">Latest Content</h1>
                <p className="text-gray-600 dark:text-gray-400 mb-8">
                    Most recent sermon uploads
                </p>

                {isLoading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                        {[...Array(pageSize)].map((_, i) => (
                            <div key={i} className="card animate-pulse">
                                <div className="aspect-video bg-gray-300 dark:bg-gray-600 rounded-lg mb-3"></div>
                                <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded mb-2"></div>
                                <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-2/3"></div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <>
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-6">
                            <p className="text-gray-600 dark:text-gray-400 text-sm">
                                {pagination?.total?.toLocaleString() || 0} sermons indexed
                            </p>
                            <div className="flex items-center gap-2 text-sm">
                                <span className="text-gray-600 dark:text-gray-400">Videos per page:</span>
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

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                            {videos.map((video: any) => (
                                <VideoCard
                                    key={video.id}
                                    id={video.id}
                                    title={video.vid_title || video.name}
                                    preacher={video.vid_preacher}
                                    date={video.date}
                                    thumbnail={video.thumbnail_stream_url || video.thumb_url}
                                    views={video.clicks}
                                    duration={video.runtime_minutes}
                                />
                            ))}
                        </div>

                        {/* Pagination */}
                        {pagination && pagination.totalPages > 1 && (
                            <div className="flex justify-center gap-2 mt-8">
                                <button
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                    className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Previous
                                </button>
                                <span className="px-4 py-2 text-gray-600 dark:text-gray-400">
                                    Page {page} of {pagination.totalPages}
                                </span>
                                <button
                                    onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                                    disabled={page === pagination.totalPages}
                                    className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Next
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </>
    );
}

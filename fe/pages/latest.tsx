/**
 * Latest/New Content Page
 * Displays most recent video uploads with compact cards
 */
import Head from 'next/head';
import { useMemo, useState } from 'react';
import { useVideos } from '@/hooks/useApi';
import VideoCard from '@/components/VideoCard';
import config from '@/config';

export default function LatestPage() {
    const PAGE_SIZES = [24, 48, 96];
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(PAGE_SIZES[0]);
    const [selectedCategory, setSelectedCategory] = useState('');
    const [selectedCategoryLabel, setSelectedCategoryLabel] = useState('');
    const [lengthFilter, setLengthFilter] = useState<'all' | 'long' | 'short'>('all');
    const [showRssModal, setShowRssModal] = useState(false);
    const rssUrl = `${config.api.baseUrl}/api/rss`;
    const { videos, pagination, isLoading } = useVideos({
        page: page.toString(),
        limit: pageSize.toString(),
        sort: 'date',
        ...(selectedCategory && { category: selectedCategory })
    });

    const totalPages = pagination?.totalPages || Math.ceil((pagination?.total || 0) / pageSize);
    const canGoNext = totalPages ? page < totalPages : videos.length === pageSize;
    const canGoPrev = page > 1;

    const filteredVideos = useMemo(() => {
        if (lengthFilter === 'all') return videos;
        return videos.filter((video: any) => {
            const minutes = Number(video.runtime_minutes);
            if (Number.isNaN(minutes)) return false;
            return lengthFilter === 'long' ? minutes >= 20 : minutes < 20;
        });
    }, [videos, lengthFilter]);

    return (
        <>
            <Head>
                <title>Latest Content - ALLthePREACHING</title>
                <meta name="description" content="Latest sermon uploads on ALLthePREACHING" />
            </Head>

            <div className="container mx-auto px-4 py-8">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
                    <div>
                        <h1 className="text-4xl font-bold mb-2">Latest Content</h1>
                        <p className="text-scheme-e-text/90">
                            Most recent sermon uploads
                        </p>
                    </div>
                    <div className="relative inline-flex">
                        <button
                            type="button"
                            onClick={() => setShowRssModal(true)}
                            className="inline-flex items-center gap-2 text-primary-600 hover:text-primary-700 dark:text-primary-400"
                        >
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M5 3a1 1 0 000 2c5.523 0 10 4.477 10 10a1 1 0 102 0C17 8.373 11.627 3 5 3z" />
                                <path d="M4 9a1 1 0 011-1 7 7 0 017 7 1 1 0 11-2 0 5 5 0 00-5-5 1 1 0 01-1-1zM3 15a2 2 0 114 0 2 2 0 01-4 0z" />
                            </svg>
                            Subscribe via RSS
                        </button>
                        {showRssModal && (
                            <div className="absolute top-full right-0 mt-3 z-30 w-[min(420px,90vw)] rounded-xl border border-secondary-dark/50 bg-scheme-b-bg/90 p-4 shadow-xl backdrop-blur-md">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <h3 className="text-base font-semibold">RSS Feed URL</h3>
                                        <p className="text-xs text-secondary-light/80">Copy and paste into your RSS reader.</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setShowRssModal(false)}
                                        className="text-secondary-light hover:text-primary"
                                        aria-label="Close RSS popup"
                                    >
                                        ✕
                                    </button>
                                </div>
                                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                                    <input
                                        type="text"
                                        readOnly
                                        value={rssUrl}
                                        onFocus={(event) => event.currentTarget.select()}
                                        className="w-full rounded-lg border border-secondary-dark/40 bg-scheme-c-bg/60 px-3 py-2 text-xs text-scheme-c-text"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => navigator.clipboard?.writeText(rssUrl)}
                                        className="btn-secondary text-xs whitespace-nowrap"
                                    >
                                        Copy
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {selectedCategory && (
                    <div className="mb-6 flex flex-wrap items-center gap-3 text-sm">
                        <span className="px-3 py-1 rounded-full bg-primary/10 text-primary font-semibold">
                            Filtering by {selectedCategoryLabel || selectedCategory}
                        </span>
                        <button
                            className="text-secondary-light hover:text-primary"
                            onClick={() => {
                                setSelectedCategory('');
                                setSelectedCategoryLabel('');
                                setPage(1);
                            }}
                        >
                            Clear filter
                        </button>
                    </div>
                )}

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
                            <p className="text-scheme-e-text/90 text-sm">
                                {pagination?.total?.toLocaleString() || 0} sermons indexed
                            </p>
                            <div className="flex flex-wrap items-center gap-3 text-sm">
                                <div className="flex items-center gap-2">
                                    <span className="text-scheme-e-text/90">Show only:</span>
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
                                <span className="text-scheme-e-text/90">Videos per page:</span>
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
                            {filteredVideos.map((video: any, index: number) => (
                                <div
                                    key={video.id}
                                    className="animate-scale-in"
                                    style={{ animationDelay: `${index * 0.04}s` }}
                                >
                                    <VideoCard
                                        id={video.id}
                                        title={video.vid_title || video.name}
                                        preacher={video.vid_preacher}
                                        date={video.date}
                                        thumbnail={video.thumbnail_stream_url || video.thumb_url}
                                        views={video.clicks}
                                        duration={video.runtime_minutes}
                                        categoryName={video.search_category}
                                        categorySlug={video.vid_category}
                                        onCategorySelect={(slug, name) => {
                                            setSelectedCategory(prev => {
                                                const nextSlug = prev === slug ? '' : slug;
                                                if (nextSlug) {
                                                    setSelectedCategoryLabel(name || slug);
                                                } else {
                                                    setSelectedCategoryLabel('');
                                                }
                                                return nextSlug;
                                            });
                                            setPage(1);
                                        }}
                                    />
                                </div>
                            ))}
                        </div>

                        {/* Pagination */}
                        {(pagination || videos.length > 0) && (
                            <div className="flex justify-center gap-2 mt-8">
                                <button
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={!canGoPrev}
                                    className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Previous
                                </button>
                                <span className="px-4 py-2 text-scheme-e-text/90">
                                    Page {page} of {totalPages || 1}
                                </span>
                                <button
                                    onClick={() => setPage(p => (totalPages ? Math.min(totalPages, p + 1) : p + 1))}
                                    disabled={!canGoNext}
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

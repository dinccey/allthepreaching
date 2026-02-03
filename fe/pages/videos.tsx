/**
 * Videos Page
 * Browse all videos with category filtering
 */
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useMemo, useState, useEffect } from 'react';
import { useVideos } from '@/hooks/useApi';
import VideoCard from '@/components/VideoCard';
import api from '@/lib/api';
import config from '@/config';

interface Category {
    slug: string;
    name: string;
    videoCount: number;
}

export default function VideosPage() {
    const router = useRouter();
    const [page, setPage] = useState(1);
    const PAGE_SIZES = [24, 48, 96];
    const LEGACY_LIMITS: Record<number, number> = { 25: 24, 50: 48, 100: 96 };
    const [pageSize, setPageSize] = useState(PAGE_SIZES[0]);
    const [selectedCategory, setSelectedCategory] = useState<string>('');
    const [categories, setCategories] = useState<Category[]>([]);
    const [allCategories, setAllCategories] = useState<Category[]>([]);
    const [categorySearch, setCategorySearch] = useState('');
    const [showAllCategories, setShowAllCategories] = useState(false);
    const [lengthFilter, setLengthFilter] = useState<'all' | 'long' | 'short'>('all');
    const [showRssModal, setShowRssModal] = useState(false);
    const rssUrl = `${config.api.baseUrl}/api/rss`;

    const { videos, pagination, isLoading } = useVideos({
        page: page.toString(),
        limit: pageSize.toString(),
        sort: 'date',
        ...(selectedCategory && { category: selectedCategory })
    });

    const filteredVideos = useMemo(() => {
        if (lengthFilter === 'all') return videos;
        return videos.filter((video: any) => {
            const minutes = Number(video.runtime_minutes);
            if (Number.isNaN(minutes)) return false;
            return lengthFilter === 'long' ? minutes >= 20 : minutes < 20;
        });
    }, [videos, lengthFilter]);

    const totalPages = pagination?.totalPages || Math.ceil((pagination?.total || 0) / pageSize);
    const canGoNext = totalPages ? page < totalPages : videos.length === pageSize;
    const canGoPrev = page > 1;

    // Fetch categories on mount
    useEffect(() => {
        fetchCategories();
    }, []);

    const syncQuery = (nextPage = page, nextLimit = pageSize, nextCategory = selectedCategory) => {
        const query = { ...router.query } as Record<string, any>;
        query.page = nextPage.toString();
        query.limit = nextLimit.toString();
        if (nextCategory) {
            query.category = nextCategory;
        } else {
            delete query.category;
        }
        router.replace({ pathname: '/videos', query }, undefined, { shallow: true });
    };

    // Sync category and pagination from URL
    useEffect(() => {
        if (!router.isReady) return;
        const queryPage = typeof router.query.page === 'string' ? parseInt(router.query.page, 10) : 1;
        const rawLimit = typeof router.query.limit === 'string' ? parseInt(router.query.limit, 10) : pageSize;
        const queryLimit = LEGACY_LIMITS[rawLimit] || rawLimit;
        const queryCategory = typeof router.query.category === 'string' ? router.query.category : '';

        if (!Number.isNaN(queryPage) && queryPage !== page) {
            setPage(queryPage);
        }

        if (PAGE_SIZES.includes(queryLimit) && queryLimit !== pageSize) {
            setPageSize(queryLimit);
            if (rawLimit !== queryLimit) {
                syncQuery(queryPage, queryLimit, queryCategory);
            }
        }

        if (queryCategory !== selectedCategory) {
            setSelectedCategory(queryCategory);
            if (queryCategory) {
                setPage(1);
            }
        }
    }, [router.isReady, router.query.category, router.query.page, router.query.limit, pageSize, page, selectedCategory]);

    const fetchCategories = async () => {
        try {
            const data = await api.categories.list() as Category[];
            setAllCategories(data);
            setCategories(data.slice(0, 5)); // Show top 5 by default
        } catch (error) {
            console.error('Failed to fetch categories:', error);
        }
    };

    // Handle category search
    useEffect(() => {
        if (categorySearch) {
            const filtered = allCategories.filter(cat =>
                cat.name.toLowerCase().includes(categorySearch.toLowerCase())
            );
            setCategories(filtered);
            setShowAllCategories(true);
        } else {
            setCategories(allCategories.slice(0, 5));
            setShowAllCategories(false);
        }
    }, [categorySearch, allCategories]);

    const handleCategorySelect = (slug: string, displayName?: string) => {
        const nextSlug = slug === selectedCategory ? '' : slug;
        setSelectedCategory(nextSlug);
        setPage(1);
        setCategorySearch('');
        setShowAllCategories(false);
        syncQuery(1, pageSize, nextSlug);
    };

    const getCategoryLabel = () => {
        if (!selectedCategory) return '';
        return allCategories.find(cat => cat.slug === selectedCategory)?.name || selectedCategory;
    };

    const activeCategoryLabel = getCategoryLabel();

    const handlePageSizeChange = (size: number) => {
        setPageSize(size);
        setPage(1);
        syncQuery(1, size, selectedCategory);
    };

    return (
        <>
            <Head>
                <title>All Videos - ALLthePREACHING</title>
                <meta name="description" content="Browse all sermon videos on ALLthePREACHING" />
            </Head>

            <div className="container mx-auto px-4 py-8">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-6">
                    <div>
                        <h1 className="text-4xl font-bold mb-2 text-primary-100">All Videos</h1>
                        <p className="text-secondary-light">
                            Latest uploads {activeCategoryLabel && `in ${activeCategoryLabel}`}
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

                {/* Category Filter */}
                <div className="mb-8">
                    <div className="bg-scheme-b-bg/80 rounded-xl p-5 border border-secondary-dark/60 shadow-inner shadow-black/30">
                        <label className="block text-sm font-semibold mb-3">
                            Filter by Category
                        </label>

                        {/* Category Pills */}
                        <div className="flex flex-wrap gap-2 mb-3 animate-fade-in">
                            <button
                                onClick={() => handleCategorySelect('')}
                                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${!selectedCategory
                                    ? 'bg-primary text-scheme-c-bg shadow-lg shadow-primary/40'
                                    : 'bg-scheme-c-bg/40 text-scheme-b-text border border-secondary-dark/50 hover:bg-scheme-b-bg/70'
                                    }`}
                            >
                                All Categories
                            </button>
                        </div>

                        <div
                            className={`max-h-32 overflow-y-auto pr-1 transition-[max-height] duration-300 ${showAllCategories || categorySearch ? 'max-h-56' : 'max-h-32'
                                }`}
                        >
                            <div className="flex flex-wrap gap-2">
                                {categories.map((cat, index) => (
                                    <button
                                        key={cat.slug}
                                        onClick={() => handleCategorySelect(cat.slug, cat.name)}
                                        style={{ animationDelay: `${index * 0.03}s` }}
                                        className={`px-4 py-2 rounded-full text-sm font-medium transition-all animate-scale-in ${selectedCategory === cat.slug
                                            ? 'bg-primary text-scheme-c-bg shadow-lg shadow-primary/30'
                                            : 'bg-scheme-c-bg/40 text-scheme-b-text border border-secondary-dark/50 hover:bg-scheme-b-bg/70'
                                            }`}
                                    >
                                        {cat.name} ({cat.videoCount})
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Search Input */}
                        <div className="relative animate-fade-in">
                            <input
                                type="text"
                                placeholder="Search for more categories..."
                                value={categorySearch}
                                onChange={(e) => setCategorySearch(e.target.value)}
                                className="w-full px-4 py-2 pl-10 rounded-lg border border-secondary-dark/40 bg-scheme-c-bg/40 focus:bg-scheme-c-bg/70 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary text-scheme-c-text placeholder:text-secondary-light/70 transition-all duration-300"
                            />
                            <svg
                                className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-secondary-light/70"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>

                        {/* Show more button */}
                        {!showAllCategories && allCategories.length > 5 && !categorySearch && (
                            <button
                                onClick={() => {
                                    setCategories(allCategories);
                                    setShowAllCategories(true);
                                }}
                                className="mt-3 text-sm text-primary hover:underline"
                            >
                                Show all {allCategories.length} categories
                            </button>
                        )}
                    </div>
                </div>

                {/* Controls */}
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-6">
                    <p className="text-secondary-light">
                        Showing {pagination?.page || page} of {totalPages || 1} pages
                    </p>
                    <div className="flex flex-wrap items-center gap-3 text-sm">
                        <div className="flex items-center gap-2">
                            <span className="text-secondary-light">Show only:</span>
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
                        <span className="text-secondary-light">Videos per page:</span>
                        <div className="flex rounded-full border border-secondary-dark/40 overflow-hidden">
                            {PAGE_SIZES.map(size => (
                                <button
                                    key={size}
                                    onClick={() => handlePageSizeChange(size)}
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

                {/* Videos Grid */}
                {isLoading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {[...Array(20)].map((_, i) => (
                            <div key={i} className="card animate-pulse">
                                <div className="aspect-video bg-scheme-c-bg/50 rounded-lg mb-3"></div>
                                <div className="h-4 bg-scheme-c-bg/40 rounded mb-2"></div>
                                <div className="h-3 bg-scheme-c-bg/30 rounded w-2/3"></div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
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
                                        onCategorySelect={handleCategorySelect}
                                    />
                                </div>
                            ))}
                        </div>

                        {filteredVideos.length === 0 && (
                            <div className="text-center py-12">
                                <p className="text-secondary-light">
                                    No videos found for this filter.
                                </p>
                            </div>
                        )}

                        {/* Pagination */}
                        {(pagination || videos.length > 0) && (
                            <div className="flex justify-center gap-2 mt-8">
                                <button
                                    onClick={() => {
                                        setPage(p => {
                                            const nextPage = Math.max(1, p - 1);
                                            syncQuery(nextPage, pageSize, selectedCategory);
                                            return nextPage;
                                        });
                                    }}
                                    disabled={!canGoPrev}
                                    className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Previous
                                </button>
                                <span className="px-4 py-2 text-secondary-light">
                                    Page {page} of {totalPages || 1}
                                </span>
                                <button
                                    onClick={() => {
                                        setPage(p => {
                                            const nextPage = totalPages ? Math.min(totalPages, p + 1) : p + 1;
                                            syncQuery(nextPage, pageSize, selectedCategory);
                                            return nextPage;
                                        });
                                    }}
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

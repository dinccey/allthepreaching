/**
 * Videos Page
 * Browse all videos with category filtering
 */
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useState, useEffect } from 'react';
import { useVideoLanguages, useVideos } from '@/hooks/useApi';
import VideoCard from '@/components/VideoCard';
import CompactVideoCard from '@/components/CompactVideoCard';
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
    const [showCategoryFilter, setShowCategoryFilter] = useState(false);
    const [lengthFilter, setLengthFilter] = useState<'all' | 'long' | 'short'>('all');
    const [selectedLanguage, setSelectedLanguage] = useState('');
    const [sortMode, setSortMode] = useState<'date' | 'views'>('date');
    const [showMobileFilters, setShowMobileFilters] = useState(false);
    const [showRssModal, setShowRssModal] = useState(false);
    const [jumpPage, setJumpPage] = useState('');
    const rssUrl = `${config.api.baseUrl}/api/rss`;
    const { languages } = useVideoLanguages();

    const { videos, pagination, isLoading } = useVideos({
        page: page.toString(),
        limit: pageSize.toString(),
        sort: sortMode,
        ...(selectedCategory && { category: selectedCategory }),
        ...(selectedLanguage && { language: selectedLanguage }),
        ...(lengthFilter !== 'all' && { length: lengthFilter })
    });

    const totalPages = pagination?.totalPages || Math.ceil((pagination?.total || 0) / pageSize);
    const canGoNext = totalPages ? page < totalPages : videos.length === pageSize;
    const canGoPrev = page > 1;

    // Fetch categories on mount
    useEffect(() => {
        fetchCategories();
    }, []);

    useEffect(() => {
        if (selectedCategory || categorySearch) {
            setShowCategoryFilter(true);
        }
    }, [selectedCategory, categorySearch]);

    const syncQuery = (
        nextPage = page,
        nextLimit = pageSize,
        nextCategory = selectedCategory,
        nextLanguage = selectedLanguage,
        nextLength = lengthFilter,
        nextSort = sortMode
    ) => {
        const query = { ...router.query } as Record<string, any>;
        query.page = nextPage.toString();
        query.limit = nextLimit.toString();
        if (nextCategory) {
            query.category = nextCategory;
        } else {
            delete query.category;
        }
        if (nextLanguage) {
            query.language = nextLanguage;
        } else {
            delete query.language;
        }
        if (nextLength && nextLength !== 'all') {
            query.length = nextLength;
        } else {
            delete query.length;
        }
        if (nextSort && nextSort !== 'date') {
            query.sort = nextSort;
        } else {
            delete query.sort;
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
        const queryLanguage = typeof router.query.language === 'string' ? router.query.language : '';
        const queryLength = typeof router.query.length === 'string' ? router.query.length : 'all';
        const querySort = typeof router.query.sort === 'string' ? router.query.sort : 'date';

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

        if (queryLanguage !== selectedLanguage) {
            setSelectedLanguage(queryLanguage);
            setPage(1);
        }

        if ((queryLength === 'short' || queryLength === 'long' || queryLength === 'all') && queryLength !== lengthFilter) {
            setLengthFilter(queryLength as 'all' | 'long' | 'short');
            setPage(1);
        }

        if ((querySort === 'views' || querySort === 'date') && querySort !== sortMode) {
            setSortMode(querySort as 'views' | 'date');
            setPage(1);
        }
    }, [
        router.isReady,
        router.query.category,
        router.query.page,
        router.query.limit,
        router.query.language,
        router.query.length,
        router.query.sort,
        pageSize,
        page,
        selectedCategory,
        selectedLanguage,
        lengthFilter,
        sortMode,
    ]);

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
        syncQuery(1, pageSize, nextSlug, selectedLanguage, lengthFilter);
    };

    const getCategoryLabel = () => {
        if (!selectedCategory) return '';
        return allCategories.find(cat => cat.slug === selectedCategory)?.name || selectedCategory;
    };

    const activeCategoryLabel = getCategoryLabel();

    const handlePageSizeChange = (size: number) => {
        setPageSize(size);
        setPage(1);
        syncQuery(1, size, selectedCategory, selectedLanguage, lengthFilter, sortMode);
    };

    const handleJumpSubmit = () => {
        const raw = parseInt(jumpPage, 10);
        if (Number.isNaN(raw)) return;
        const safeTotal = totalPages || 1;
        const nextPage = Math.min(Math.max(raw, 1), safeTotal);
        setPage(nextPage);
        syncQuery(nextPage, pageSize, selectedCategory, selectedLanguage, lengthFilter, sortMode);
    };

    const handleCopyRss = async () => {
        try {
            await navigator.clipboard.writeText(rssUrl);
        } catch (error) {
            console.warn('Failed to copy RSS URL', error);
        }
    };

    const mobilePillClass = 'h-9 px-4 rounded-full text-sm font-semibold transition-colors';
    const mobileSegmentContainerClass = 'inline-flex h-9 rounded-full border border-secondary-dark/40 overflow-hidden';
    const mobileSegmentButtonClass = 'h-9 px-4 text-sm font-semibold transition-colors';

    return (
        <>
            <Head>
                <title>Videos - ALLthePREACHING</title>
            </Head>
            <div className="container mx-auto px-4 py-8">
                <div className="flex flex-col gap-4">
                    <div className="relative inline-flex w-full">
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
                        <div
                            className={`absolute top-full left-0 mt-3 z-30 w-[min(420px,90vw)] rounded-xl border border-secondary-dark/50 bg-scheme-b-bg/90 p-4 shadow-xl backdrop-blur-md popup-transition ${showRssModal
                                ? 'popup-open'
                                : 'popup-closed'
                                }`}
                            aria-hidden={!showRssModal}
                        >
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
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={handleCopyRss}
                                        className="btn-secondary text-xs whitespace-nowrap"
                                    >
                                        Copy
                                    </button>
                                    <a
                                        href={rssUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="btn-secondary text-xs whitespace-nowrap"
                                    >
                                        Open
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-row items-end justify-between gap-3">
                        <div className="hidden md:flex flex-col items-start gap-2">
                            <div className="flex flex-wrap items-center gap-3 text-sm">
                                <button
                                    type="button"
                                    onClick={() => setShowCategoryFilter((prev) => !prev)}
                                    className={`px-4 py-1 rounded-full border border-secondary-dark/40 font-semibold transition-colors ${showCategoryFilter
                                        ? 'bg-primary text-scheme-c-bg border-primary/60'
                                        : 'text-secondary-light hover:bg-scheme-b-bg/60'
                                        }`}
                                >
                                    Categories
                                </button>
                                <div className="flex items-center gap-2">
                                    <span className="text-secondary-light">Sort:</span>
                                    <div className="flex rounded-full border border-secondary-dark/40 overflow-hidden">
                                        <button
                                            onClick={() => {
                                                setSortMode('date');
                                                setPage(1);
                                                syncQuery(1, pageSize, selectedCategory, selectedLanguage, lengthFilter, 'date');
                                            }}
                                            className={`px-4 py-1 font-semibold transition-colors ${sortMode === 'date'
                                                ? 'bg-primary text-scheme-c-bg'
                                                : 'text-secondary-light hover:bg-scheme-b-bg/60'
                                                }`}
                                        >
                                            Latest
                                        </button>
                                        <button
                                            onClick={() => {
                                                setSortMode('views');
                                                setPage(1);
                                                syncQuery(1, pageSize, selectedCategory, selectedLanguage, lengthFilter, 'views');
                                            }}
                                            className={`px-4 py-1 font-semibold transition-colors ${sortMode === 'views'
                                                ? 'bg-primary text-scheme-c-bg'
                                                : 'text-secondary-light hover:bg-scheme-b-bg/60'
                                                }`}
                                        >
                                            Popular
                                        </button>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-secondary-light">Language:</span>
                                    <select
                                        value={selectedLanguage}
                                        onChange={(event) => {
                                            const next = event.target.value;
                                            setSelectedLanguage(next);
                                            setPage(1);
                                            syncQuery(1, pageSize, selectedCategory, next, lengthFilter, sortMode);
                                        }}
                                        className="styled-select px-4 py-1 rounded-full border border-secondary-dark/40 bg-scheme-c-bg/60 text-scheme-c-text shadow-sm hover:shadow-md hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                                    >
                                        <option value="">All</option>
                                        {languages.map(code => (
                                            <option key={code} value={code}>
                                                {code.toUpperCase()}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-secondary-light">Show only:</span>
                                    <div className="flex rounded-full border border-secondary-dark/40 overflow-hidden">
                                        <button
                                            onClick={() => {
                                                setLengthFilter('all');
                                                setPage(1);
                                                syncQuery(1, pageSize, selectedCategory, selectedLanguage, 'all', sortMode);
                                            }}
                                            className={`px-4 py-1 font-semibold transition-colors ${lengthFilter === 'all'
                                                ? 'bg-primary text-scheme-c-bg'
                                                : 'text-secondary-light hover:bg-scheme-b-bg/60'
                                                }`}
                                        >
                                            All
                                        </button>
                                        <button
                                            onClick={() => {
                                                setLengthFilter('long');
                                                setPage(1);
                                                syncQuery(1, pageSize, selectedCategory, selectedLanguage, 'long', sortMode);
                                            }}
                                            className={`px-4 py-1 font-semibold transition-colors ${lengthFilter === 'long'
                                                ? 'bg-primary text-scheme-c-bg'
                                                : 'text-secondary-light hover:bg-scheme-b-bg/60'
                                                }`}
                                        >
                                            Long (20m+)
                                        </button>
                                        <button
                                            onClick={() => {
                                                setLengthFilter('short');
                                                setPage(1);
                                                syncQuery(1, pageSize, selectedCategory, selectedLanguage, 'short', sortMode);
                                            }}
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
                        <div className="hidden md:flex flex-col items-end gap-2">
                            <p className="text-sm text-secondary-light text-right">
                                Showing {pagination?.page || page} of {totalPages || 1} pages
                            </p>
                            {activeCategoryLabel && (
                                <p className="text-scheme-e-text/70 text-right">
                                    {activeCategoryLabel}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Controls */}
                    <div className="flex flex-col gap-1 mb-0 md:hidden">
                        <div className="flex flex-col gap-1">
                            <button
                                type="button"
                                onClick={() => setShowMobileFilters((prev) => !prev)}
                                className={`md:hidden self-start ${mobilePillClass} border border-secondary-dark/40 ${showMobileFilters
                                    ? 'bg-primary text-scheme-c-bg border-primary/60'
                                    : 'text-secondary-light hover:bg-scheme-b-bg/60'
                                    }`}
                            >
                                Filters
                            </button>
                        </div>

                        <div
                            className={`collapsible rounded-xl border border-secondary-dark/40 bg-scheme-c-bg/40 text-sm ${showMobileFilters
                                ? 'is-open'
                                : 'is-closed'
                                }`}
                            aria-hidden={!showMobileFilters}
                        >
                            <div className="collapsible-content flex flex-col gap-3 p-3">
                            <div className="flex items-center justify-between gap-3">
                                <span className="text-secondary-light">Categories</span>
                                <button
                                    type="button"
                                    onClick={() => setShowCategoryFilter((prev) => !prev)}
                                    className={`${mobilePillClass} border border-secondary-dark/40 ${showCategoryFilter
                                        ? 'bg-primary text-scheme-c-bg border-primary/60'
                                        : 'text-secondary-light hover:bg-scheme-b-bg/60'
                                        }`}
                                >
                                    {showCategoryFilter ? 'Hide' : 'Show'}
                                </button>
                            </div>

                            <div className="flex items-center justify-between gap-3">
                                <span className="text-secondary-light">Sort</span>
                                <div className={mobileSegmentContainerClass}>
                                    <button
                                        onClick={() => {
                                            setSortMode('date');
                                            setPage(1);
                                            syncQuery(1, pageSize, selectedCategory, selectedLanguage, lengthFilter, 'date');
                                        }}
                                        className={`${mobileSegmentButtonClass} ${sortMode === 'date'
                                            ? 'bg-primary text-scheme-c-bg'
                                            : 'text-secondary-light hover:bg-scheme-b-bg/60'
                                            }`}
                                    >
                                        Latest
                                    </button>
                                    <button
                                        onClick={() => {
                                            setSortMode('views');
                                            setPage(1);
                                            syncQuery(1, pageSize, selectedCategory, selectedLanguage, lengthFilter, 'views');
                                        }}
                                        className={`${mobileSegmentButtonClass} ${sortMode === 'views'
                                            ? 'bg-primary text-scheme-c-bg'
                                            : 'text-secondary-light hover:bg-scheme-b-bg/60'
                                            }`}
                                    >
                                        Popular
                                    </button>
                                </div>
                            </div>

                            <div className="flex items-center justify-between gap-3">
                                <span className="text-secondary-light">Language</span>
                                <select
                                    value={selectedLanguage}
                                    onChange={(event) => {
                                        const next = event.target.value;
                                        setSelectedLanguage(next);
                                        setPage(1);
                                        syncQuery(1, pageSize, selectedCategory, next, lengthFilter, sortMode);
                                    }}
                                    className="styled-select h-9 min-w-[110px] rounded-full border border-secondary-dark/40 bg-scheme-c-bg/60 px-3 text-sm text-scheme-c-text shadow-sm hover:shadow-md hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all"
                                >
                                    <option value="">All</option>
                                    {languages.map(code => (
                                        <option key={code} value={code}>
                                            {code.toUpperCase()}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex items-center justify-between gap-3">
                                <span className="text-secondary-light">Length</span>
                                <div className={mobileSegmentContainerClass}>
                                    <button
                                        onClick={() => {
                                            setLengthFilter('all');
                                            setPage(1);
                                            syncQuery(1, pageSize, selectedCategory, selectedLanguage, 'all', sortMode);
                                        }}
                                        className={`${mobileSegmentButtonClass} ${lengthFilter === 'all'
                                            ? 'bg-primary text-scheme-c-bg'
                                            : 'text-secondary-light hover:bg-scheme-b-bg/60'
                                            }`}
                                    >
                                        All
                                    </button>
                                    <button
                                        onClick={() => {
                                            setLengthFilter('long');
                                            setPage(1);
                                            syncQuery(1, pageSize, selectedCategory, selectedLanguage, 'long', sortMode);
                                        }}
                                        className={`${mobileSegmentButtonClass} ${lengthFilter === 'long'
                                            ? 'bg-primary text-scheme-c-bg'
                                            : 'text-secondary-light hover:bg-scheme-b-bg/60'
                                            }`}
                                    >
                                        Long
                                    </button>
                                    <button
                                        onClick={() => {
                                            setLengthFilter('short');
                                            setPage(1);
                                            syncQuery(1, pageSize, selectedCategory, selectedLanguage, 'short', sortMode);
                                        }}
                                        className={`${mobileSegmentButtonClass} ${lengthFilter === 'short'
                                            ? 'bg-primary text-scheme-c-bg'
                                            : 'text-secondary-light hover:bg-scheme-b-bg/60'
                                            }`}
                                    >
                                        Short
                                    </button>
                                </div>
                            </div>

                            <div className="flex items-center justify-between gap-3">
                                <span className="text-secondary-light">Per page</span>
                                <div className={mobileSegmentContainerClass}>
                                    {PAGE_SIZES.map(size => (
                                        <button
                                            key={size}
                                            onClick={() => handlePageSizeChange(size)}
                                            className={`h-9 px-3 text-sm font-semibold transition-colors ${pageSize === size
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
                    </div>

                {/* Category Filter */}
                <div
                    className={`collapsible mb-2 ${showCategoryFilter
                        ? 'is-open'
                        : 'is-closed'
                        }`}
                    aria-hidden={!showCategoryFilter}
                >
                    <div className="collapsible-content">
                        <div className={`bg-scheme-c-bg/40 rounded-xl p-5 border border-secondary-dark/40 ${showCategoryFilter ? 'animate-slide-up' : ''}`}>
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
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6">
                            {videos.map((video: any, index: number) => (
                                <div
                                    key={video.id}
                                    className="animate-scale-in"
                                    style={{ animationDelay: `${index * 0.04}s` }}
                                >
                                    <div className="md:hidden">
                                        <CompactVideoCard
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
                                    <div className="hidden md:block">
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
                                </div>
                            ))}
                        </div>

                        {videos.length === 0 && (
                            <div className="text-center py-12">
                                <p className="text-secondary-light">
                                    No videos found for this filter.
                                </p>
                            </div>
                        )}

                        {/* Pagination */}
                        {(pagination || videos.length > 0) && (
                            <div className="flex flex-col items-center gap-2 mt-8">
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => {
                                            setPage(p => {
                                                const nextPage = Math.max(1, p - 1);
                                                syncQuery(nextPage, pageSize, selectedCategory, selectedLanguage, lengthFilter, sortMode);
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
                                                syncQuery(nextPage, pageSize, selectedCategory, selectedLanguage, lengthFilter, sortMode);
                                                return nextPage;
                                            });
                                        }}
                                        disabled={!canGoNext}
                                        className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Next
                                    </button>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                    <span className="text-secondary-light">Jump to:</span>
                                    <input
                                        type="number"
                                        min={1}
                                        max={totalPages || 1}
                                        value={jumpPage}
                                        onChange={(event) => setJumpPage(event.target.value)}
                                        onKeyDown={(event) => {
                                            if (event.key === 'Enter') {
                                                handleJumpSubmit();
                                            }
                                        }}
                                        className="w-20 rounded-lg border border-secondary-dark/40 bg-scheme-c-bg/60 px-3 py-1 text-sm text-scheme-c-text focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                                        placeholder="#"
                                    />
                                    <button
                                        type="button"
                                        onClick={handleJumpSubmit}
                                        className="btn-secondary text-xs"
                                    >
                                        Go
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
        </>
    );
}

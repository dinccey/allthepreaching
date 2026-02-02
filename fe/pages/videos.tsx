/**
 * Videos Page
 * Browse all videos with category filtering
 */
import Head from 'next/head';
import { useVideos } from '@/hooks/useApi';
import VideoCard from '@/components/VideoCard';
import { useState, useEffect } from 'react';
import api from '@/lib/api';

interface Category {
    slug: string;
    name: string;
    videoCount: number;
}

export default function VideosPage() {
    const [page, setPage] = useState(1);
    const PAGE_SIZES = [25, 50, 100];
    const [pageSize, setPageSize] = useState(PAGE_SIZES[0]);
    const [selectedCategory, setSelectedCategory] = useState<string>('');
    const [categories, setCategories] = useState<Category[]>([]);
    const [allCategories, setAllCategories] = useState<Category[]>([]);
    const [categorySearch, setCategorySearch] = useState('');
    const [showAllCategories, setShowAllCategories] = useState(false);

    const { videos, pagination, isLoading } = useVideos({
        page: page.toString(),
        limit: pageSize.toString(),
        sort: 'date',
        ...(selectedCategory && { category: selectedCategory })
    });

    // Fetch categories on mount
    useEffect(() => {
        fetchCategories();
    }, []);

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

    const handleCategorySelect = (slug: string) => {
        setSelectedCategory(slug === selectedCategory ? '' : slug);
        setPage(1);
        setCategorySearch('');
        setShowAllCategories(false);
    };

    const getCategoryLabel = () => {
        if (!selectedCategory) return '';
        return allCategories.find(cat => cat.slug === selectedCategory)?.name || selectedCategory;
    };

    const activeCategoryLabel = getCategoryLabel();

    const handlePageSizeChange = (size: number) => {
        setPageSize(size);
        setPage(1);
    };

    return (
        <>
            <Head>
                <title>All Videos - ALLthePREACHING</title>
                <meta name="description" content="Browse all sermon videos on ALLthePREACHING" />
            </Head>

            <div className="container mx-auto px-4 py-8">
                <h1 className="text-4xl font-bold mb-2 text-primary-100">All Videos</h1>
                <p className="text-secondary-light mb-6">
                    Latest uploads {activeCategoryLabel && `in ${activeCategoryLabel}`}
                </p>

                {/* Category Filter */}
                <div className="mb-8">
                    <div className="bg-scheme-b-bg/80 rounded-xl p-5 border border-secondary-dark/60 shadow-inner shadow-black/30">
                        <label className="block text-sm font-semibold mb-3">
                            Filter by Category
                        </label>

                        {/* Category Pills */}
                        <div className="flex flex-wrap gap-2 mb-3">
                            <button
                                onClick={() => handleCategorySelect('')}
                                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${!selectedCategory
                                    ? 'bg-primary text-scheme-c-bg shadow-lg shadow-primary/40'
                                    : 'bg-scheme-c-bg/40 text-scheme-b-text border border-secondary-dark/50 hover:bg-scheme-b-bg/70'
                                    }`}
                            >
                                All Categories
                            </button>

                            {categories.map((cat) => (
                                <button
                                    key={cat.slug}
                                    onClick={() => handleCategorySelect(cat.slug)}
                                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${selectedCategory === cat.slug
                                        ? 'bg-primary text-scheme-c-bg shadow-lg shadow-primary/30'
                                        : 'bg-scheme-c-bg/40 text-scheme-b-text border border-secondary-dark/50 hover:bg-scheme-b-bg/70'
                                        }`}
                                >
                                    {cat.name} ({cat.videoCount})
                                </button>
                            ))}
                        </div>

                        {/* Search Input */}
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Search for more categories..."
                                value={categorySearch}
                                onChange={(e) => setCategorySearch(e.target.value)}
                                className="w-full px-4 py-2 pl-10 rounded-lg border border-secondary-dark/40 bg-scheme-c-bg/40 focus:bg-scheme-c-bg/70 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary text-scheme-c-text placeholder:text-secondary-light/70"
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
                        Showing {(pagination?.page || page)} of {pagination?.totalPages || 1} pages
                    </p>
                    <div className="flex items-center gap-2 text-sm">
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

                        {videos.length === 0 && (
                            <div className="text-center py-12">
                                <p className="text-secondary-light">
                                    No videos found in this category.
                                </p>
                            </div>
                        )}

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
                                <span className="px-4 py-2 text-secondary-light">
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

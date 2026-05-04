/**
 * Search results page
 */
import { useRouter } from 'next/router';
import Head from 'next/head';
import { useMemo, useState, useEffect } from 'react';
import api from '@/lib/api';
import VideoCard from '@/components/VideoCard';
import CompactVideoCard from '@/components/CompactVideoCard';
import SubtitlesResultCard from '@/components/search/SubtitlesResultCard';

const PAGE_SIZE_VIDEOS = 24;
const PAGE_SIZE_SUBTITLES = 50;

export default function SearchPage() {
    const router = useRouter();
    const { q, search, 'advanced-search': advancedSearch, page: pageParam } = router.query;
    const [results, setResults] = useState<any[]>([]);
    const [total, setTotal] = useState<number>(0);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [mode, setMode] = useState<'videos' | 'subtitles'>('videos');

    const basicQuery = useMemo(
        () => (typeof search === 'string' ? search : typeof q === 'string' ? q : ''),
        [search, q]
    );
    const subtitleQuery = useMemo(
        () => (typeof advancedSearch === 'string' ? advancedSearch : ''),
        [advancedSearch]
    );
    const currentPage = useMemo(() => {
        const p = parseInt(pageParam as string, 10);
        return Number.isNaN(p) || p < 0 ? 0 : p;
    }, [pageParam]);

    const pageSize = mode === 'subtitles' ? PAGE_SIZE_SUBTITLES : PAGE_SIZE_VIDEOS;
    const totalPages = total > 0 ? Math.ceil(total / pageSize) : 0;

    useEffect(() => {
        if (subtitleQuery || basicQuery) {
            performSearch(basicQuery, subtitleQuery, currentPage);
        }
    }, [basicQuery, subtitleQuery, currentPage]);

    const goToPage = (newPage: number) => {
        const query: Record<string, string | string[]> = { ...router.query as Record<string, string | string[]> };
        if (newPage === 0) {
            delete query.page;
        } else {
            query.page = String(newPage);
        }
        router.push({ pathname: router.pathname, query }, undefined, { scroll: true });
    };

    const performSearch = async (categoryInfo: string, advancedQuery: string, pageNum = 0) => {
        setIsLoading(true);
        setError(null);

        try {
            if (advancedQuery) {
                const data = await api.search({
                    query: advancedQuery,
                    categoryInfo,
                    limit: PAGE_SIZE_SUBTITLES,
                    offset: pageNum * PAGE_SIZE_SUBTITLES,
                    mode: 'subtitles'
                }) as { results?: any[]; mode?: 'subtitles' | 'videos'; total?: number };
                setMode(data.mode || 'subtitles');
                setResults(data.results || []);
                setTotal(data.total || 0);
            } else {
                const data = await api.search(categoryInfo, PAGE_SIZE_VIDEOS, pageNum * PAGE_SIZE_VIDEOS) as { results?: any[]; mode?: 'subtitles' | 'videos'; total?: number };
                setMode(data.mode || 'videos');
                setResults(data.results || []);
                setTotal(data.total || 0);
            }
        } catch (err: any) {
            setError(err.message || 'Search failed');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            <Head>
                <title>Search: {subtitleQuery || basicQuery || 'Results'} - ALLthePREACHING</title>
            </Head>

            <div className="container mx-auto px-4 py-8">
                <h1 className="text-3xl font-bold mb-2">Search Results</h1>
                <p className="text-gray-600 dark:text-gray-400 mb-8">
                    {(subtitleQuery || basicQuery) && (
                        <>Results for "{subtitleQuery || basicQuery}"</>
                    )}
                </p>

                {isLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
                        {[...Array(8)].map((_, i) => (
                            <div key={i} className="card animate-pulse">
                                <div className="aspect-video bg-gray-300 dark:bg-gray-600 rounded-lg mb-3"></div>
                                <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded mb-2"></div>
                                <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-2/3"></div>
                            </div>
                        ))}
                    </div>
                ) : error ? (
                    <div className="text-center py-12">
                        <p className="text-red-600 dark:text-red-400">{error}</p>
                    </div>
                ) : results.length === 0 ? (
                    <div className="text-center py-12">
                        <p className="text-gray-600 dark:text-gray-400">No results found</p>
                    </div>
                ) : (
                    <>
                        <p className="mb-6 text-gray-600 dark:text-gray-400">
                            {total > 0
                                ? `Showing ${currentPage * pageSize + 1}–${Math.min((currentPage + 1) * pageSize, total)} of ${total} result${total !== 1 ? 's' : ''}`
                                : `Found ${results.length} result${results.length !== 1 ? 's' : ''}`
                            }
                        </p>
                        {mode === 'subtitles' ? (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {results.map((item: any, index: number) => (
                                    <SubtitlesResultCard
                                        key={`${item.subtitlePath || item.title}-${index}`}
                                        author={item.author}
                                        title={item.title}
                                        videoDate={item.videoDate}
                                        subtitlePath={item.subtitlePath}
                                        videoId={item.videoId || item.video_id}
                                        categoryName={item.categoryName || item.category_name}
                                        matchCount={item.matchCount}
                                        subtitles={item.subtitles || []}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-6">
                                {results.map((video: any) => (
                                    <div key={video.id}>
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
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        {totalPages > 1 && (
                            <div className="flex items-center justify-center gap-4 mt-10">
                                <button
                                    onClick={() => goToPage(currentPage - 1)}
                                    disabled={currentPage === 0}
                                    className="px-4 py-2 rounded bg-gray-200 dark:bg-gray-700 disabled:opacity-40 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                                >
                                    ← Prev
                                </button>
                                <span className="text-gray-700 dark:text-gray-300 text-sm">
                                    Page {currentPage + 1} of {totalPages}
                                </span>
                                <button
                                    onClick={() => goToPage(currentPage + 1)}
                                    disabled={currentPage >= totalPages - 1}
                                    className="px-4 py-2 rounded bg-gray-200 dark:bg-gray-700 disabled:opacity-40 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                                >
                                    Next →
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </>
    );
}

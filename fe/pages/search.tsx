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

export default function SearchPage() {
    const router = useRouter();
    const { q, search, 'advanced-search': advancedSearch } = router.query;
    const [results, setResults] = useState<any[]>([]);
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

    useEffect(() => {
        if (subtitleQuery || basicQuery) {
            performSearch(basicQuery, subtitleQuery);
        }
    }, [basicQuery, subtitleQuery]);

    const performSearch = async (categoryInfo: string, advancedQuery: string) => {
        setIsLoading(true);
        setError(null);

        try {
            if (advancedQuery) {
                const data = await api.search({
                    query: advancedQuery,
                    categoryInfo,
                    maxResults: 600,
                    mode: 'subtitles'
                }) as { results?: any[]; mode?: 'subtitles' | 'videos' };
                setMode(data.mode || 'subtitles');
                setResults(data.results || []);
            } else {
                const data = await api.search(categoryInfo) as { results?: any[]; mode?: 'subtitles' | 'videos' };
                setMode(data.mode || 'videos');
                setResults(data.results || []);
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
                            Found {results.length} result{results.length !== 1 ? 's' : ''}
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
                    </>
                )}
            </div>
        </>
    );
}

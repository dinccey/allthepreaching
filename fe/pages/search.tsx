/**
 * Search results page
 */
import { useRouter } from 'next/router';
import Head from 'next/head';
import { useState, useEffect } from 'react';
import api from '@/lib/api';
import VideoCard from '@/components/VideoCard';

export default function SearchPage() {
    const router = useRouter();
    const { q } = router.query;
    const [results, setResults] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (q) {
            performSearch(q as string);
        }
    }, [q]);

    const performSearch = async (query: string) => {
        setIsLoading(true);
        setError(null);

        try {
            const data = await api.search(query) as { results?: any[] };
            setResults(data.results || []);
        } catch (err: any) {
            setError(err.message || 'Search failed');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            <Head>
                <title>Search: {q} - ALLthePREACHING</title>
            </Head>

            <div className="container mx-auto px-4 py-8">
                <h1 className="text-3xl font-bold mb-2">Search Results</h1>
                <p className="text-gray-600 dark:text-gray-400 mb-8">
                    {q && `Results for "${q}"`}
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
                        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
                            {results.map((video: any) => (
                                <VideoCard
                                    key={video.id}
                                    id={video.id}
                                    title={video.vid_title || video.name}
                                    preacher={video.vid_preacher}
                                    date={video.date}
                                    thumbnail={video.thumb_url}
                                    views={video.clicks}
                                    duration={video.runtime_minutes}
                                />
                            ))}
                        </div>
                    </>
                )}
            </div>
        </>
    );
}

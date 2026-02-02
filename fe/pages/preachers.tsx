/**
 * Preachers listing page
 */
import Head from 'next/head';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { usePreachers } from '@/hooks/useApi';

export default function PreachersPage() {
    const { preachers, isLoading } = usePreachers();
    const [searchTerm, setSearchTerm] = useState('');

    const filteredPreachers = useMemo(() => {
        if (!searchTerm) return preachers;
        const query = searchTerm.toLowerCase().trim();
        return preachers.filter((preacher: any) =>
            preacher.name?.toLowerCase().includes(query)
        );
    }, [preachers, searchTerm]);

    return (
        <>
            <Head>
                <title>Preachers - ALLthePREACHING</title>
                <meta name="description" content="Browse all preachers on ALLthePREACHING" />
            </Head>

            <div className="container mx-auto px-4 py-8">
                <h1 className="text-4xl font-bold mb-8">Preachers</h1>

                <div className="mb-8 max-w-xl">
                    <label className="block text-sm font-semibold mb-2" htmlFor="preacher-search">
                        Search preachers
                    </label>
                    <div className="relative">
                        <input
                            id="preacher-search"
                            type="text"
                            placeholder="Type a preacher name..."
                            value={searchTerm}
                            onChange={(event) => setSearchTerm(event.target.value)}
                            className="w-full px-4 py-2 pl-10 rounded-lg border border-secondary-dark/40 bg-scheme-c-bg/40 focus:bg-scheme-c-bg/70 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary text-scheme-c-text placeholder:text-secondary-light/70 transition-all duration-300"
                        />
                        <svg
                            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary-light/70"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>
                </div>

                {isLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[...Array(12)].map((_, i) => (
                            <div key={i} className="card animate-pulse">
                                <div className="h-6 bg-gray-300 dark:bg-gray-600 rounded mb-3"></div>
                                <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-2/3"></div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredPreachers.map((preacher: any) => (
                            <Link
                                key={preacher.name}
                                href={`/preacher/${preacher.name}`}
                                className="card group"
                            >
                                <h2 className="text-xl font-bold mb-2 group-hover:text-primary-600 dark:group-hover:text-primary-400">
                                    {preacher.name}
                                </h2>
                                <div className="text-sm text-scheme-e-text/90">
                                    <p>{preacher.videoCount} sermons</p>
                                    {preacher.latestVideo && (
                                        <p>Latest: {new Date(preacher.latestVideo).toLocaleDateString()}</p>
                                    )}
                                </div>
                            </Link>
                        ))}
                        {filteredPreachers.length === 0 && (
                            <div className="col-span-full text-center text-secondary-light">
                                No preachers found.
                            </div>
                        )}
                    </div>
                )}
            </div>
        </>
    );
}

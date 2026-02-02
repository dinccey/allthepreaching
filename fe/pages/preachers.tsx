/**
 * Preachers listing page
 */
import Head from 'next/head';
import Link from 'next/link';
import { usePreachers } from '@/hooks/useApi';

export default function PreachersPage() {
    const { preachers, isLoading } = usePreachers();

    return (
        <>
            <Head>
                <title>Preachers - ALLthePREACHING</title>
                <meta name="description" content="Browse all preachers on ALLthePREACHING" />
            </Head>

            <div className="container mx-auto px-4 py-8">
                <h1 className="text-4xl font-bold mb-8">Preachers</h1>

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
                        {preachers.map((preacher: any) => (
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
                    </div>
                )}
            </div>
        </>
    );
}

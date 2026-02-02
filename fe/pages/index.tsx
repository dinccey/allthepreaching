/**
 * Homepage
 * Landing page with featured videos and introduction
 */
import Head from 'next/head';
import Link from 'next/link';
import { useVideos } from '@/hooks/useApi';
import VideoCard from '@/components/VideoCard';

export default function Home() {
    const { videos, isLoading } = useVideos({ limit: '12', sort: 'date' });

    return (
        <>
            <Head>
                <title>ALLthePREACHING - KJV-only Independent Fundamental Baptist Preaching</title>
                <meta
                    name="description"
                    content="Faithful KJV-only preaching from Independent Fundamental Baptist pastors. Watch sermons on salvation, doctrine, and hard preaching."
                />
            </Head>

            <div className="container mx-auto px-4 py-8">
                {/* Hero Section */}
                <section className="text-center mb-12 animate-fade-in">
                    <h1 className="text-4xl md:text-5xl font-serif font-bold text-primary-800 dark:text-primary-400 mb-4">
                        # ALLthePREACHING
                    </h1>
                    <p className="text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto mb-6">
                        Faithful preaching from Independent Fundamental Baptist pastors who stand on the
                        King James Bible and preach the whole counsel of God without compromise.
                    </p>
                    <div className="flex flex-wrap justify-center gap-4">
                        <Link href="/category/salvation" className="btn-primary">
                            The Bible Way to Heaven
                        </Link>
                        <Link href="/preachers" className="btn-secondary">
                            Browse Preachers
                        </Link>
                    </div>
                </section>

                {/* Special Thanks Section */}
                <section className="card mb-12 animate-slide-up">
                    <h2 className="text-2xl font-bold mb-4">Special Thanks</h2>
                    <p className="text-gray-700 dark:text-gray-300 mb-4">
                        This website is dedicated to spreading the pure word of God through faithful preaching.
                        We thank God for the men who boldly declare His truth in these last days.
                    </p>
                    <p className="text-gray-700 dark:text-gray-300">
                        <strong>Note:</strong> This site features sermons from pastors who believe in the
                        King James Bible as the preserved word of God, salvation by grace through faith alone,
                        and the fundamental doctrines of the faith once delivered unto the saints.
                    </p>
                </section>

                {/* Latest Videos */}
                <section className="mb-12">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-3xl font-bold">Latest Sermons</h2>
                        <Link href="/videos" className="text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300">
                            View All →
                        </Link>
                    </div>

                    {isLoading ? (
                        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
                            {[...Array(12)].map((_, i) => (
                                <div key={i} className="card animate-pulse">
                                    <div className="aspect-video bg-gray-300 dark:bg-gray-600 rounded-lg mb-3"></div>
                                    <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded mb-2"></div>
                                    <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-2/3"></div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
                            {videos.map((video: any) => (
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
                    )}
                </section>

                {/* Categories */}
                <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                    <Link href="/category/salvation" className="card group">
                        <h3 className="text-xl font-bold mb-2 group-hover:text-primary-600 dark:group-hover:text-primary-400">
                            Salvation
                        </h3>
                        <p className="text-gray-600 dark:text-gray-400">
                            Learn the Bible way to be saved and have eternal life through faith in Jesus Christ.
                        </p>
                    </Link>

                    <Link href="/category/hard-preaching" className="card group">
                        <h3 className="text-xl font-bold mb-2 group-hover:text-primary-600 dark:group-hover:text-primary-400">
                            Hard Preaching
                        </h3>
                        <p className="text-gray-600 dark:text-gray-400">
                            Bold, uncompromising sermons that confront sin and declare God's truth.
                        </p>
                    </Link>

                    <Link href="/category/documentaries" className="card group">
                        <h3 className="text-xl font-bold mb-2 group-hover:text-primary-600 dark:group-hover:text-primary-400">
                            Documentaries
                        </h3>
                        <p className="text-gray-600 dark:text-gray-400">
                            In-depth video documentaries on Bible doctrine and Christian living.
                        </p>
                    </Link>
                </section>
            </div>
        </>
    );
}

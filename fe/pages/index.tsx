/**
 * Homepage
 * Redesigned to match the old site's layout with modern enhancements
 * Features: Hero section, category banners, latest videos grid
 */
import Head from 'next/head';
import Link from 'next/link';
import { useRef } from 'react';
import { useVideos } from '@/hooks/useApi';
import VideoCard from '@/components/VideoCard';
import HeroSection from '@/components/HeroSection';
import config from '@/config';

export default function Home() {
    const { videos, isLoading } = useVideos({ limit: '6', sort: 'date' });
    const carouselRef = useRef<HTMLDivElement | null>(null);

    const scrollCarousel = (direction: 'left' | 'right') => {
        const container = carouselRef.current;
        if (!container) return;
        const amount = Math.max(280, Math.floor(container.clientWidth * 0.8));
        container.scrollBy({ left: direction === 'left' ? -amount : amount, behavior: 'smooth' });
    };

    return (
        <>
            <Head>
                <title>ALLthePREACHING - Everything NIFB</title>
                <meta
                    name="description"
                    content="Every NIFB Sermon and More. Faithful KJV-only preaching from Independent Fundamental Baptist pastors."
                />
                <meta name="keywords" content="NIFB,KJV,Baptist,preaching,sermons,IFB,Steven Anderson,faithful word" />
            </Head>

            {/* Hero Section */}
            <HeroSection />

            {/* Main Content */}
            <div className="bg-gradient-to-b from-scheme-e-bg to-scheme-c-bg">
                {/* Latest Videos Section */}
                <section id="videos" className="py-16 bg-light-bg/5 dark:bg-dark-bg/5 backdrop-blur-sm scroll-mt-32">
                    <div className="container mx-auto px-4">
                        <div className="flex items-center justify-between mb-8 animate-slide-in-left">
                            <h2 className="text-3xl md:text-4xl font-bold text-scheme-e-heading">
                                Latest <span className="highlight text-glow">Sermons</span>
                            </h2>
                            <Link
                                href="/videos"
                                className="text-primary hover:text-primary-300 transition-all duration-300 hover:scale-105 font-semibold"
                            >
                                View All →
                            </Link>
                        </div>

                        <div className="relative">
                            <button
                                type="button"
                                aria-label="Scroll left"
                                onClick={() => scrollCarousel('left')}
                                className="flex items-center justify-center absolute -left-6 sm:-left-8 md:-left-10 lg:-left-12 xl:-left-16 top-1/2 -translate-y-1/2 h-9 w-9 sm:h-10 sm:w-10 rounded-full bg-scheme-b-bg/80 border border-primary/30 text-primary hover:bg-primary/20 transition-all z-10"
                            >
                                ‹
                            </button>

                            {isLoading ? (
                                <div className="flex gap-6 overflow-x-auto pb-4 no-scrollbar">
                                    {[...Array(6)].map((_, i) => (
                                        <div key={i} className="card animate-pulse min-h-[300px] w-[260px] sm:w-[320px] md:w-[360px] lg:w-[420px] shrink-0">
                                            <div className="aspect-video-stable rounded-lg mb-4"></div>
                                            <div className="h-4 skeleton mb-3"></div>
                                            <div className="h-3 skeleton w-2/3"></div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div
                                    ref={carouselRef}
                                    className="flex gap-6 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-4 no-scrollbar"
                                >
                                    {videos.map((video: any, index: number) => (
                                        <div
                                            key={video.id}
                                            className="snap-start shrink-0 w-[260px] sm:w-[320px] md:w-[360px] lg:w-[420px] animate-scale-in"
                                            style={{ animationDelay: `${index * 0.05}s` }}
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
                                            />
                                        </div>
                                    ))}
                                </div>
                            )}

                            <button
                                type="button"
                                aria-label="Scroll right"
                                onClick={() => scrollCarousel('right')}
                                className="flex items-center justify-center absolute -right-6 sm:-right-8 md:-right-10 lg:-right-12 xl:-right-16 top-1/2 -translate-y-1/2 h-9 w-9 sm:h-10 sm:w-10 rounded-full bg-scheme-b-bg/80 border border-primary/30 text-primary hover:bg-primary/20 transition-all z-10"
                            >
                                ›
                            </button>
                        </div>
                    </div>
                </section>

                {/* Extras Section */}
                <section id="extras" className="py-16 scroll-mt-32">
                    <div className="container mx-auto px-4">
                        <div className="text-center mb-10">
                            <h2 className="text-3xl md:text-4xl font-bold text-scheme-e-heading">
                                <span className="highlight text-glow">Extras</span>
                            </h2>
                            <p className="text-scheme-e-text text-lg mt-3">
                                one <span className="highlight text-glow">site</span> {' || '} every{' '}
                                <span className="highlight text-glow">video</span> {' || '} all{' '}
                                <span className="highlight text-glow">nifb</span>
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-12">
                            <Link
                                href="/videos?sort=date"
                                className="group rounded-2xl border border-primary/20 bg-scheme-b-bg/80 p-6 text-scheme-b-text shadow-lg hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 backdrop-blur-md"
                            >
                                <h3 className="text-xl font-semibold text-scheme-b-text mb-2">Newest Content</h3>
                                <p className="text-scheme-e-text/90">Jump to the most recent sermons across the archive.</p>
                                <span className="text-primary font-semibold mt-4 inline-flex items-center">
                                    Browse Latest →
                                </span>
                            </Link>

                            <Link
                                href="https://www.allthelaws.com/"
                                target="_blank"
                                className="group rounded-2xl border border-primary/20 bg-scheme-b-bg/80 p-6 text-scheme-b-text shadow-lg hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 backdrop-blur-md"
                            >
                                <h3 className="text-xl font-semibold text-scheme-b-text mb-2">Bible Laws Project</h3>
                                <p className="text-scheme-e-text/90">Explore a dedicated resource on biblical law and doctrine.</p>
                                <span className="text-primary font-semibold mt-4 inline-flex items-center">
                                    Visit allthelaws.com →
                                </span>
                            </Link>

                            <Link
                                href="/download-all"
                                target="_blank"
                                className="group rounded-2xl border border-primary/20 bg-scheme-b-bg/80 p-6 text-scheme-b-text shadow-lg hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 backdrop-blur-md"
                            >
                                <h3 className="text-xl font-semibold text-scheme-b-text mb-2">Download the Archive</h3>
                                <p className="text-scheme-e-text/90">Get a full offline copy of the preaching archive.</p>
                                <span className="text-primary font-semibold mt-4 inline-flex items-center">
                                    Download Options →
                                </span>
                            </Link>

                            <div className="rounded-2xl border border-primary/20 bg-scheme-b-bg/80 p-6 text-scheme-b-text shadow-lg hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 backdrop-blur-md">
                                <h3 className="text-xl font-semibold text-scheme-b-text mb-3">Soulwinning Tools</h3>
                                <div className="space-y-3 text-scheme-e-text/90">
                                    <Link
                                        href="https://flipbookpdf.net/web/site/8073761ea240888c8d70d8703b267fb30e9f0538202208.pdf.html"
                                        target="_blank"
                                        className="block hover:text-primary transition-colors"
                                    >
                                        Download the soulwinning booklet →
                                    </Link>
                                    <Link
                                        href="/sw-track"
                                        className="block hover:text-primary transition-colors"
                                    >
                                        Track your soulwinning time →
                                    </Link>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <article
                                id="doctrine"
                                className="feature-card rounded-2xl border border-primary/20 p-7 text-scheme-b-text shadow-lg"
                            >
                                <h3 className="text-2xl font-semibold text-scheme-b-text mb-4">Our Doctrine</h3>
                                <ul className="space-y-3 text-scheme-e-text/90 leading-relaxed">
                                    <li>King James Bible as the preserved, inerrant Word of God in English.</li>
                                    <li>Salvation by grace through faith alone in Jesus Christ.</li>
                                    <li>Preaching the whole counsel of God without compromise.</li>
                                </ul>
                            </article>

                            <article
                                id="whoweare"
                                className="feature-card rounded-2xl border border-primary/20 p-7 text-scheme-b-text shadow-lg"
                            >
                                <h3 className="text-2xl font-semibold text-scheme-b-text mb-4">Who We Are</h3>
                                <p className="text-scheme-e-text/90 leading-relaxed">
                                    A trusted archive of faithful preaching from New Independent Fundamental Baptist
                                    churches and like-minded preachers, committed to the old paths, soul winning, and
                                    uncompromised truth.
                                </p>
                            </article>

                            <article
                                id="salvation"
                                className="feature-card rounded-2xl border border-primary/20 p-7 text-scheme-b-text shadow-lg"
                            >
                                <h3 className="text-2xl font-semibold text-scheme-b-text mb-4">How to Be Saved</h3>
                                <p className="text-scheme-e-text/90 leading-relaxed">
                                    Salvation is a free gift received by faith alone in Jesus Christ. Believe the gospel
                                    — that Christ died for your sins, was buried, and rose again — and you will be saved.
                                </p>
                                <div className="pt-5">
                                    <Link
                                        href={config.site.salvationVideoPath}
                                        className="btn-secondary"
                                    >
                                        Watch the Gospel Message
                                    </Link>
                                </div>
                            </article>
                        </div>

                        <div className="mt-12 rounded-2xl border border-primary/20 bg-scheme-b-bg/70 p-6 text-center text-scheme-b-text shadow-lg">
                            <p className="text-scheme-e-text/90">Questions or submissions?</p>
                            <a
                                href="mailto:admin@allthepreaching.com"
                                className="text-primary hover:text-primary-300 text-lg font-semibold transition-all duration-300 inline-block mt-2"
                            >
                                admin@allthepreaching.com
                            </a>
                        </div>
                    </div>
                </section>

                {/* Bold Men Section Placeholder */}
                <section id="boldmen" className="py-16 bg-light-bg/5 dark:bg-dark-bg/5 backdrop-blur-sm scroll-mt-32">
                    <div className="container mx-auto px-4">
                        <div className="text-center mb-12 animate-slide-up">
                            <h2 className="text-3xl md:text-4xl font-bold text-scheme-e-heading mb-4">
                                <span className="highlight text-glow">Bold</span> Men of God
                            </h2>
                            <p className="text-scheme-e-text text-lg max-w-3xl mx-auto">
                                Preachers who aren't afraid to stand on the Word of God and declare the truth.
                            </p>
                        </div>
                        <div className="text-center">
                            <Link href="/preachers" className="btn-primary">
                                View All Preachers
                            </Link>
                        </div>
                    </div>
                </section>
            </div>
        </>
    );
}

/**
 * Homepage
 * Redesigned to match the old site's layout with modern enhancements
 * Features: Hero section, category banners, latest videos grid
 */
import Head from 'next/head';
import Link from 'next/link';
import { useVideos } from '@/hooks/useApi';
import VideoCard from '@/components/VideoCard';
import HeroSection from '@/components/HeroSection';
import CategoryBanner, { CategoryBannerGrid } from '@/components/CategoryBanner';

export default function Home() {
    const { videos, isLoading } = useVideos({ limit: '12', sort: 'date' });

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
                {/* About Section - Category Banners */}
                <section id="about" className="py-16 md:py-24 scroll-mt-32">
                    <div className="container mx-auto px-4">
                        <CategoryBannerGrid className="animate-slide-up">
                            <CategoryBanner
                                title="Salvation"
                                subtitle="How to be Saved"
                                description="The Bible Way to Heaven"
                                link="/category/salvation"
                                colorScheme="success"
                            />
                            <CategoryBanner
                                title="Hard Preaching"
                                subtitle="Full Sermons"
                                description="Full Book Bible Studies"
                                link="/category/sermons"
                                colorScheme="warning"
                            />
                            <CategoryBanner
                                title="Documentaries"
                                subtitle="Truth & Facts"
                                description="Informative Films & Real Subjects"
                                link="/category/documentaries"
                                colorScheme="info"
                            />
                        </CategoryBannerGrid>
                    </div>
                </section>

                {/* Latest Videos Section */}
                <section id="videos" className="py-16 bg-light-bg/5 dark:bg-dark-bg/5 backdrop-blur-sm scroll-mt-32">
                    <div className="container mx-auto px-4">
                        <div className="flex items-center justify-between mb-8 animate-slide-in-left">
                            <h2 className="text-3xl md:text-4xl font-bold text-white">
                                Latest <span className="highlight text-glow">Sermons</span>
                            </h2>
                            <Link
                                href="/videos"
                                className="text-primary hover:text-primary-300 transition-all duration-300 hover:scale-105 font-semibold"
                            >
                                View All →
                            </Link>
                        </div>

                        {isLoading ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                {[...Array(12)].map((_, i) => (
                                    <div key={i} className="card animate-pulse min-h-[300px]">
                                        <div className="aspect-video-stable rounded-lg mb-4"></div>
                                        <div className="h-4 skeleton mb-3"></div>
                                        <div className="h-3 skeleton w-2/3"></div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                {videos.map((video: any, index: number) => (
                                    <div
                                        key={video.id}
                                        className="animate-scale-in"
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
                                        />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </section>

                {/* Doctrine Section Placeholder */}
                <section id="doctrine" className="py-16 scroll-mt-32">
                    <div className="container mx-auto px-4">
                        <div className="card card-gradient max-w-4xl mx-auto text-center animate-fade-in">
                            <h2 className="text-3xl md:text-4xl font-bold mb-6">
                                Our <span className="highlight">Doctrine</span>
                            </h2>
                            <div className="space-y-4 text-light-text dark:text-dark-text leading-relaxed">
                                <p>
                                    We believe in the King James Bible as the preserved, inerrant Word of God in English.
                                </p>
                                <p>
                                    We believe in salvation by grace through faith alone in Jesus Christ,
                                    and that salvation is eternal and cannot be lost.
                                </p>
                                <p>
                                    We preach the whole counsel of God without compromise, including hard truths
                                    that many churches today refuse to address.
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Bold Men Section Placeholder */}
                <section id="boldmen" className="py-16 bg-light-bg/5 dark:bg-dark-bg/5 backdrop-blur-sm scroll-mt-32">
                    <div className="container mx-auto px-4">
                        <div className="text-center mb-12 animate-slide-up">
                            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
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

                {/* Who We Are Section */}
                <section id="whoweare" className="py-16 scroll-mt-32">
                    <div className="container mx-auto px-4">
                        <div className="card card-gradient max-w-4xl mx-auto animate-fade-in">
                            <h2 className="text-3xl md:text-4xl font-bold mb-6 text-center">
                                Who <span className="highlight">We Are</span>
                            </h2>
                            <div className="space-y-4 text-light-text dark:text-dark-text leading-relaxed">
                                <p>
                                    This website is dedicated to spreading the pure word of God through faithful preaching.
                                    We archive and organize sermons from New Independent Fundamental Baptist churches
                                    and like-minded preachers.
                                </p>
                                <p>
                                    We believe in the local church, soul winning, the old paths, and preaching that
                                    isn't watered down or compromised to be politically correct.
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Salvation Section */}
                <section id="salvation" className="py-16 bg-light-bg/5 dark:bg-dark-bg/5 backdrop-blur-sm scroll-mt-32">
                    <div className="container mx-auto px-4">
                        <div className="card card-gradient max-w-4xl mx-auto text-center animate-scale-in bg-gradient-to-br from-green-900/40 to-green-800/40">
                            <h2 className="text-3xl md:text-4xl font-bold mb-6 text-white">
                                How to be <span className="highlight text-glow">Saved</span>
                            </h2>
                            <div className="space-y-4 text-white leading-relaxed text-lg">
                                <p className="font-semibold">
                                    Salvation is a free gift that you receive by faith alone in Jesus Christ.
                                </p>
                                <p>
                                    Believe that Jesus Christ died for your sins, was buried, and rose again the third day,
                                    and you will be saved.
                                </p>
                                <div className="pt-6">
                                    <Link
                                        href="https://www.kjv1611only.com/video/01salvation/Pastor_Anderson.mp4"
                                        target="_blank"
                                        className="btn-primary text-lg"
                                    >
                                        Watch the Gospel Message
                                    </Link>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Contact Section */}
                <section id="contact" className="py-16 scroll-mt-32">
                    <div className="container mx-auto px-4">
                        <div className="card card-gradient max-w-2xl mx-auto text-center animate-fade-in">
                            <h2 className="text-3xl md:text-4xl font-bold mb-6">
                                <span className="highlight">Contact</span> Us
                            </h2>
                            <p className="text-light-text dark:text-dark-text mb-6">
                                Have a question or suggestion? Want to submit content?
                            </p>
                            <a
                                href="mailto:admin@allthepreaching.com"
                                className="text-primary hover:text-primary-300 text-xl font-semibold transition-all duration-300 hover:scale-105 inline-block"
                            >
                                admin@allthepreaching.com
                            </a>
                        </div>
                    </div>
                </section>
            </div>
        </>
    );
}

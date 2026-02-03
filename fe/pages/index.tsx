/**
 * Homepage
 * Redesigned to match the old site's layout with modern enhancements
 * Features: Hero section, category banners, latest videos grid
 */
import Head from 'next/head';
import Link from 'next/link';
import { useRef, useState } from 'react';
import { useVideos } from '@/hooks/useApi';
import VideoCard from '@/components/VideoCard';
import HeroSection from '@/components/HeroSection';
import config from '@/config';

export default function Home() {
    const { videos, isLoading } = useVideos({ limit: '6', sort: 'date' });
    const carouselRef = useRef<HTMLDivElement | null>(null);
    const [salvationTab, setSalvationTab] = useState('Acknowledgement');

    const salvationTabs = [
        {
            id: 'Acknowledgement',
            label: 'Acknowledgement',
            content: (
                <div className="space-y-3">
                    <p className="text-base font-semibold text-scheme-e-heading">Acknowledge Sin.</p>
                    <p className="text-sm italic text-scheme-e-heading/80">Romans 3:23</p>
                    <p className="text-base text-scheme-e-text/80">For all have sinned, and come short of the glory of God;</p>
                </div>
            ),
        },
        {
            id: 'Realization',
            label: 'Realization',
            content: (
                <div className="space-y-3">
                    <p className="text-base font-semibold text-scheme-e-heading">Realize the Penalty for Sin. Death & Hell.</p>
                    <div className="space-y-2">
                        <p className="text-sm italic text-scheme-e-heading/80">Romans 6:23</p>
                        <p className="text-base text-scheme-e-text/80">
                            For the wages of sin is death; but the gift of God is eternal life through Jesus Christ our Lord.
                        </p>
                        <p className="text-sm italic text-scheme-e-heading/80">Revelation 21:8</p>
                        <p className="text-base text-scheme-e-text/80">
                            But the fearful, and unbelieving, and the abominable, and murderers, and whoremongers, and sorcerers, and idolaters, and all liars, shall have their part in the lake which burneth with fire and brimstone: which is the second death.
                        </p>
                    </div>
                </div>
            ),
        },
        {
            id: 'Admission',
            label: 'Admission',
            content: (
                <div className="space-y-3">
                    <p className="text-base font-semibold text-scheme-e-heading">Admit Sin.</p>
                    <p className="text-sm italic text-scheme-e-heading/80">1 John 1:8</p>
                    <p className="text-base text-scheme-e-text/80">
                        If we say that we have no sin, we deceive ourselves, and the truth is not in us.;
                    </p>
                </div>
            ),
        },
        {
            id: 'Understanding',
            label: 'Understanding',
            content: (
                <div className="space-y-3">
                    <p className="text-base font-semibold text-scheme-e-heading">Understand Jesus Christ Died for You!</p>
                    <div className="space-y-2">
                        <p className="text-sm italic text-scheme-e-heading/80">John 3:16</p>
                        <p className="text-base text-scheme-e-text/80">
                            For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.
                        </p>
                        <p className="text-sm italic text-scheme-e-heading/80">1 Peter 2:24</p>
                        <p className="text-base text-scheme-e-text/80">
                            Who his own self bare our sins in his own body on the tree, that we, being dead to sins, should live unto righteousness: by whose stripes ye were healed.
                        </p>
                        <p className="text-sm italic text-scheme-e-heading/80">1 Timothy 3:16</p>
                        <p className="text-base text-scheme-e-text/80">
                            And without controversy great is the mystery of godliness: God was manifest in the flesh, justified in the Spirit, seen of angels, preached unto the Gentiles, believed on in the world, received up into glory.
                        </p>
                    </div>
                </div>
            ),
        },
        {
            id: 'Belief',
            label: 'Belief',
            content: (
                <div className="space-y-3">
                    <p className="text-base font-semibold text-scheme-e-heading">Believe for Salvation.</p>
                    <p className="text-sm italic text-scheme-e-heading/80">Romans 10:9-11</p>
                    <p className="text-base text-scheme-e-text/80">
                        9 That if thou shalt confess with thy mouth the Lord Jesus, and shalt believe in thine heart that God hath raised him from the dead, thou shalt be saved. 10 For with the heart man believeth unto righteousness; and with the mouth confession is made unto salvation. 11 For the scripture saith, Whosoever believeth on him shall not be ashamed.
                    </p>
                </div>
            ),
        },
        {
            id: 'Salvation',
            label: 'Salvation',
            content: (
                <div className="space-y-3">
                    <p className="text-base font-semibold text-scheme-e-heading">Saved by Faith. Not of Works!</p>
                    <p className="text-sm italic text-scheme-e-heading/80">Ephesians 2:8-9</p>
                    <p className="text-base text-scheme-e-text/80">
                        8 For by grace are ye saved through faith; and that not of yourselves: it is the gift of God: 9 Not of works, lest any man should boast.
                    </p>
                </div>
            ),
        },
        {
            id: 'Knowing',
            label: 'Knowing',
            content: (
                <div className="space-y-3">
                    <p className="text-base font-semibold text-scheme-e-heading">How do I know I'm saved?</p>
                    <p className="text-sm italic text-scheme-e-heading/80">1 John 5:10-13</p>
                    <p className="text-base text-scheme-e-text/80">
                        10 He that believeth on the Son of God hath the witness in himself: he that believeth not God hath made him a liar; because he believeth not the record that God gave of his Son. 11 And this is the record, that God hath given to us eternal life, and this life is in his Son. 12 He that hath the Son hath life; and he that hath not the Son of God hath not life. 13 These things have I written unto you that believe on the name of the Son of God; that ye may know that ye have eternal life, and that ye may believe on the name of the Son of God.
                    </p>
                    <div className="space-y-1 text-base text-scheme-e-text/80">
                        <p>1. God has given a gift.</p>
                        <p>2. The gift is eternal life.</p>
                        <p>3. Eternal life is only through God's son, Jesus Christ.</p>
                    </div>
                </div>
            ),
        },
        {
            id: 'Praying',
            label: 'Praying',
            content: (
                <div className="space-y-3">
                    <p className="text-base font-semibold text-scheme-e-heading">What should I pray?</p>
                    <p className="text-base text-scheme-e-text/80">
                        There are no special words or prayer that will grant eternal life. We simply must confess Jesus and believe with all our heart. Below is a prayer based on the scriptures mentioned above.
                    </p>
                    <p className="text-base text-scheme-e-text/80">
                        Thank you Jesus for creating me. I know that I have sinned and deserve to go to hell. Please forgive me and save me right now. I believe that Jesus died on the cross for my sins, was buried, and rose again. I am trusting in Jesus Christ alone to save me and grant me eternal life.
                    </p>
                    <p className="text-base font-semibold text-scheme-e-heading">Amen.</p>
                </div>
            ),
        },
        {
            id: 'Faith',
            label: 'Faith',
            content: (
                <div className="space-y-3">
                    <p className="text-base font-semibold text-scheme-e-heading">Is Salvation really Faith Alone?</p>
                    <p className="text-base font-semibold text-scheme-e-heading">YES!</p>
                    <p className="text-base text-scheme-e-text/80">
                        The Bible makes it abundantly clear that we are only saved by faith. If you have been taught or heard that salvation included anything else, please see the next tab "False Salvation" for a short list of what salvation is not.
                    </p>
                </div>
            ),
        },
        {
            id: 'False-Salvation',
            label: 'False Salvation',
            content: (
                <div className="space-y-3">
                    <p className="text-base font-semibold text-scheme-e-heading">What salvation is NOT!</p>
                    <p className="text-base text-scheme-e-text/80">
                        Salvation is NOT by believing or trusting in anything other than Jesus ALONE.
                    </p>
                    <div className="space-y-1 text-base text-scheme-e-text/80">
                        <p>Salvation is NOT :</p>
                        <p className="italic">Works or Good deeds</p>
                        <p className="italic">Faith plus Works</p>
                        <p className="italic">Faith plus Baptism</p>
                        <p className="italic">Faith plus "Repenting of your sins" or "Turning from your sins"</p>
                        <p className="italic">Faith plus "Going to church"</p>
                        <p className="italic">Faith plus "Saying Hail Marys"</p>
                        <p className="italic">Faith plus Anything else!</p>
                        <p className="italic">Salvation is FAITH ALONE!</p>
                    </div>
                    <p className="text-sm italic text-scheme-e-heading/80">Romans 4:5</p>
                    <p className="text-base text-scheme-e-text/80">
                        But to him that worketh not, but believeth on him that justifieth the ungodly, his faith is counted for righteousness.
                    </p>
                </div>
            ),
        },
        {
            id: 'Next-Step',
            label: 'Next Step',
            content: (
                <div className="space-y-3">
                    <p className="text-base font-semibold text-scheme-e-heading">What to do next?</p>
                    <p className="text-base text-scheme-e-text/80">
                        If you just placed all your faith on Jesus Christ then the next step is to be baptized, which represents the decision you made. The Bible then instructs us to study God's word and get involved in a local church.
                    </p>
                    <p className="text-base text-scheme-e-text/80">
                        Your best bet on a church would be the nearest Local Independent Fundamental Baptist Church. Not all IFB churches are the same or even good. Look for one that is KJV only, believes salvation is faith alone, and has a soul-winning program. One of the best places to look is at{' '}
                        <a target="_blank" rel="noreferrer" href="https://militarygetsaved.tripod.com/findchurch.html" className="text-primary underline-offset-4 hover:underline">
                            Military Get Saved
                        </a>
                        , where you can choose your location/state, and search for a church. Use the "Ctrl + F" command on your keyboard to search for "SOUL", to find a SOUL WINNING church in your area. God Bless!.
                    </p>
                </div>
            ),
        },
    ];

    const salvationSteps = [
        { label: 'Acknowledgement', percent: 0, verse: 'Romans 3:23' },
        { label: 'Realization', percent: 25, verse: 'Romans 6:23 | Revelation 21:8' },
        { label: 'Admission', percent: 30, verse: '1 John 1:8' },
        { label: 'Understanding', percent: 35, verse: 'John 3:16 | 1 Peter 2:24 | 1 Timothy 3:16' },
        { label: 'Belief', percent: 40, verse: 'Romans 10:9-11' },
        { label: 'Salvation', percent: 45, verse: 'Ephesians 2:8-9' },
        { label: 'Knowing', percent: 50, verse: '1 John 5:10-13' },
        { label: 'Praying', percent: 60, verse: "The Sinner's Prayer" },
        { label: 'Faith', percent: 70, verse: 'Salvation by Faith Alone' },
        { label: 'Next Step', percent: 90, verse: 'Finding a Local Church' },
    ];

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

            {/* Latest Videos Section */}
            <section id="videos" className="pt-16 pb-14 bg-scheme-e-bg dark:bg-scheme-c-bg border-b border-primary/10">
                <div className="container mx-auto px-4">
                    <div className="flex items-center justify-between mb-8">
                        <h2 className="text-3xl font-bold text-scheme-e-heading">
                            Latest <span className="highlight">Sermons</span>
                        </h2>
                        <Link
                            href="/videos"
                            className="text-primary hover:text-primary-300 font-semibold transition-colors"
                        >
                            View All →
                        </Link>
                    </div>

                    <div className="relative overflow-visible">
                        <button
                            type="button"
                            aria-label="Scroll left"
                            onClick={() => scrollCarousel('left')}
                            className="flex items-center justify-center absolute -left-4 md:-left-12 top-1/2 -translate-y-1/2 h-10 w-10 z-10 rounded-full bg-scheme-b-bg border border-primary/30 text-white shadow-lg hover:bg-primary transition-colors hidden md:flex"
                        >
                            ‹
                        </button>

                        {isLoading ? (
                            <div className="flex gap-6 overflow-x-auto overflow-y-visible pt-4 pb-6 no-scrollbar">
                                {[...Array(6)].map((_, i) => (
                                    <div key={i} className="shrink-0 w-[280px] md:w-[350px]">
                                        <div className="aspect-video bg-gray-200 dark:bg-gray-800 rounded-lg animate-pulse mb-3"></div>
                                        <div className="h-4 bg-gray-200 dark:bg-gray-800 rounded animate-pulse w-3/4 mb-2"></div>
                                        <div className="h-3 bg-gray-200 dark:bg-gray-800 rounded animate-pulse w-1/2"></div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div
                                ref={carouselRef}
                                className="flex gap-6 overflow-x-auto overflow-y-visible scroll-smooth snap-x snap-mandatory pt-4 pb-6 no-scrollbar"
                            >
                                {videos.map((video: any) => (
                                    <div
                                        key={video.id}
                                        className="snap-start shrink-0 w-[280px] md:w-[350px]"
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
                            className="flex items-center justify-center absolute -right-4 md:-right-12 top-1/2 -translate-y-1/2 h-10 w-10 z-10 rounded-full bg-scheme-b-bg border border-primary/30 text-white shadow-lg hover:bg-primary transition-colors hidden md:flex"
                        >
                            ›
                        </button>
                    </div>
                </div>
            </section>

            {/* Main Categories Banners - Full width split */}
            <section className="grid grid-cols-1 md:grid-cols-3">
                {/* Banner 1: Salvation */}
                <Link
                    href={config.site.salvationVideoPath}
                    className="group relative bg-scheme-b-bg py-20 px-8 text-center hover:bg-[#3d3936] transition-colors duration-300"
                >
                    <div className="relative z-10 text-scheme-b-text group-hover:text-white">
                        <h3 className="text-3xl font-light mb-2 opacity-90 group-hover:opacity-100">Salvation</h3>
                        <p className="text-xl font-bold text-primary mb-4 tracking-wide group-hover:text-white group-hover:scale-105 transition-transform">THE BIBLE WAY TO HEAVEN</p>
                        <span className="inline-block border border-primary/40 px-4 py-1 text-sm text-scheme-b-text/80 rounded group-hover:bg-white group-hover:text-black group-hover:border-white/40 transition-colors">
                            Watch Video
                        </span>
                    </div>
                </Link>

                {/* Banner 2: Hard Preaching */}
                <Link
                    href="/videos?sort=date"
                    className="group relative bg-scheme-c-bg py-20 px-8 text-center hover:bg-[#1a1816] transition-colors duration-300 border-l border-r border-[#333]/30"
                >
                    <div className="relative z-10 text-scheme-c-text group-hover:text-white">
                        <h3 className="text-3xl font-light mb-2 opacity-90 group-hover:opacity-100">Hard Preaching</h3>
                        <p className="text-xl font-bold text-primary mb-4 tracking-wide group-hover:text-white group-hover:scale-105 transition-transform">FULL SERMONS & STUDIES</p>
                        <span className="inline-block border border-primary/40 px-4 py-1 text-sm text-scheme-c-text/80 rounded group-hover:bg-white group-hover:text-black group-hover:border-white/40 transition-colors">
                            Browse Library
                        </span>
                    </div>
                </Link>

                {/* Banner 3: Documentaries */}
                <Link
                    href="/videos?q=documentary&page=1&limit=24&category=docs"
                    className="group relative bg-scheme-d-bg py-20 px-8 text-center hover:bg-[#3d2c1c] transition-colors duration-300"
                >
                    <div className="relative z-10 text-scheme-d-text group-hover:text-white">
                        <h3 className="text-3xl font-light mb-2 opacity-90 group-hover:opacity-100">Documentaries</h3>
                        <p className="text-xl font-bold text-primary mb-4 tracking-wide group-hover:text-white group-hover:scale-105 transition-transform">TRUTH & FACTS</p>
                        <span className="inline-block border border-primary/40 px-4 py-1 text-sm text-scheme-d-text/80 rounded group-hover:bg-white group-hover:text-black group-hover:border-white/40 transition-colors">
                            Explore Films
                        </span>
                    </div>
                </Link>
            </section>

            {/* About Section - Clean Layout */}
            <section className="py-20 bg-scheme-e-bg text-scheme-e-text">
                <div className="container mx-auto px-6 md:px-12 text-center">
                    <h2 className="text-4xl font-bold mb-6 text-scheme-e-heading">
                        About <span className="highlight">This Site</span>
                    </h2>
                    <div className="w-20 h-1 bg-primary mx-auto mb-10"></div>

                    <p className="max-w-4xl mx-auto text-lg leading-relaxed mb-16 text-scheme-e-text/80">
                        This site is here to spread the Gospel of Jesus Christ and expose the truth of this world to as many people as possible.
                        We host sermons from <strong className="text-primary">New IFB</strong> pastors, videos on creationism, sermon clips,
                        and traditional hymns. Check back daily for new content!
                    </p>

                    <div className="grid md:grid-cols-3 gap-12">
                        {/* Column 1 */}
                        <div className="space-y-4">
                            <div className="text-5xl text-primary mb-4 flex justify-center">
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 640 640"
                                    className="w-12 h-12 text-primary drop-shadow-md"
                                    aria-hidden="true"
                                >
                                    <path
                                        fill="currentColor"
                                        d="M320 312C386.3 312 440 258.3 440 192C440 125.7 386.3 72 320 72C253.7 72 200 125.7 200 192C200 258.3 253.7 312 320 312zM290.3 368C191.8 368 112 447.8 112 546.3C112 562.7 125.3 576 141.7 576L498.3 576C514.7 576 528 562.7 528 546.3C528 447.8 448.2 368 349.7 368L290.3 368z"
                                    />
                                </svg>
                            </div>
                            <h3 className="text-xl font-bold text-scheme-e-heading uppercase tracking-widest">NIFB Pastors</h3>
                            <p className="leading-relaxed text-sm">
                                Steven Anderson • Jonathan Shelley<br />
                                Aaron Thompson • Bruce Mejia<br />
                                Dillon Awes • And Many More
                            </p>
                        </div>

                        {/* Column 2 */}
                        <div className="space-y-4">
                            <div className="text-5xl text-primary mb-4 flex justify-center">
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 640 640"
                                    className="w-12 h-12 text-primary drop-shadow-md"
                                    aria-hidden="true"
                                >
                                    <path
                                        fill="currentColor"
                                        d="M344 56C344 42.7 333.3 32 320 32C306.7 32 296 42.7 296 56L296 80L264 80C250.7 80 240 90.7 240 104C240 117.3 250.7 128 264 128L296 128L296 176L197.4 241.8C184 250.7 176 265.6 176 281.7L176 320L96.2 365.6C76.3 377 64 398.2 64 421.1L64 512C64 547.3 92.7 576 128 576C202.7 576 213.4 576 448 576L512 576C547.3 576 576 547.3 576 512L576 421.1C576 398.1 563.7 376.9 543.8 365.5L464 320L464 281.7C464 265.7 456 250.7 442.6 241.8L344 176L344 128L376 128C389.3 128 400 117.3 400 104C400 90.7 389.3 80 376 80L344 80L344 56zM320 384C355.3 384 384 412.7 384 448L384 528L256 528L256 448C256 412.7 284.7 384 320 384z"
                                    />
                                </svg>
                            </div>
                            <h3 className="text-xl font-bold text-scheme-e-heading uppercase tracking-widest">Baptist Churches</h3>
                            <p className="leading-relaxed text-sm">
                                Faithful Word • Stedfast<br />
                                First Works • Sure Foundation<br />
                                Anchor
                            </p>
                        </div>

                        {/* Column 3 */}
                        <div className="space-y-4">
                            <div className="text-5xl text-primary mb-4 flex justify-center">
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 640 640"
                                    className="w-12 h-12 text-primary drop-shadow-md"
                                    aria-hidden="true"
                                >
                                    <path
                                        fill="currentColor"
                                        d="M415.9 344L225 344C227.9 408.5 242.2 467.9 262.5 511.4C273.9 535.9 286.2 553.2 297.6 563.8C308.8 574.3 316.5 576 320.5 576C324.5 576 332.2 574.3 343.4 563.8C354.8 553.2 367.1 535.8 378.5 511.4C398.8 467.9 413.1 408.5 416 344zM224.9 296L415.8 296C413 231.5 398.7 172.1 378.4 128.6C367 104.2 354.7 86.8 343.3 76.2C332.1 65.7 324.4 64 320.4 64C316.4 64 308.7 65.7 297.5 76.2C286.1 86.8 273.8 104.2 262.4 128.6C242.1 172.1 227.8 231.5 224.9 296zM176.9 296C180.4 210.4 202.5 130.9 234.8 78.7C142.7 111.3 74.9 195.2 65.5 296L176.9 296zM65.5 344C74.9 444.8 142.7 528.7 234.8 561.3C202.5 509.1 180.4 429.6 176.9 344L65.5 344zM463.9 344C460.4 429.6 438.3 509.1 406 561.3C498.1 528.6 565.9 444.8 575.3 344L463.9 344zM575.3 296C565.9 195.2 498.1 111.3 406 78.7C438.3 130.9 460.4 210.4 463.9 296L575.3 296z"
                                    />
                                </svg>
                            </div>
                            <h3 className="text-xl font-bold text-scheme-e-heading uppercase tracking-widest">The Movement</h3>
                            <p className="leading-relaxed text-sm">
                                Zero Fear • Zero Compromise<br />
                                King James Bible Only<br />
                                Soulwinning Daily
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Doctrinal Beliefs - Darker Band */}
            <section className="py-24 bg-scheme-c-bg text-scheme-c-text relative">
                {/* Decorative background element */}
                <div className="absolute top-0 left-0 w-full h-full overflow-hidden opacity-5 pointer-events-none">
                    <div className="absolute -top-1/2 -left-1/4 w-[800px] h-[800px] rounded-full bg-primary blur-3xl"></div>
                </div>

                <div className="container mx-auto px-6 relative z-10">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-4xl font-bold mb-4 text-scheme-c-heading">Doctrinal Beliefs</h2>
                        <p className="text-scheme-c-text/70">What we stand for</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-12">
                        {/* Item 1 */}
                        <div className="text-center group">
                            <div className="w-36 h-36 mx-auto mb-6 rounded-full bg-scheme-c-bg/80 border-2 border-primary/30 flex items-center justify-center group-hover:bg-primary group-hover:scale-105 transition-all duration-500 shadow-lg group-hover:shadow-primary/50 relative overflow-hidden">
                                <div className="absolute inset-0 rounded-full border-4 border-primary/10 scale-90 group-hover:scale-100 transition-transform duration-500"></div>
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 640 640"
                                    className="w-14 h-14 text-primary group-hover:text-scheme-c-bg transition-colors duration-300"
                                    aria-hidden="true"
                                >
                                    <path
                                        fill="currentColor"
                                        d="M192 576C139 576 96 533 96 480L96 160C96 107 139 64 192 64L496 64C522.5 64 544 85.5 544 112L544 400C544 420.9 530.6 438.7 512 445.3L512 512C529.7 512 544 526.3 544 544C544 561.7 529.7 576 512 576L192 576zM192 448C174.3 448 160 462.3 160 480C160 497.7 174.3 512 192 512L448 512L448 448L192 448zM288 144L288 192L240 192C231.2 192 224 199.2 224 208L224 240C224 248.8 231.2 256 240 256L288 256L288 368C288 376.8 295.2 384 304 384L336 384C344.8 384 352 376.8 352 368L352 256L400 256C408.8 256 416 248.8 416 240L416 208C416 199.2 408.8 192 400 192L352 192L352 144C352 135.2 344.8 128 336 128L304 128C295.2 128 288 135.2 288 144z"
                                    />
                                </svg>
                            </div>
                            <h3 className="text-xl font-bold mb-3 text-scheme-c-heading">King James Bible</h3>
                            <p className="text-sm text-scheme-c-text/70 leading-relaxed">
                                We believe that the King James Bible is the INSPIRED & PRESERVED Word of God WITHOUT error, making it our Rock, our foundation.
                            </p>
                        </div>

                        {/* Item 2 */}
                        <div className="text-center group">
                            <div className="w-36 h-36 mx-auto mb-6 rounded-full bg-scheme-c-bg/80 border-2 border-primary/30 flex items-center justify-center group-hover:bg-primary group-hover:scale-105 transition-all duration-500 shadow-lg group-hover:shadow-primary/50 relative overflow-hidden">
                                <div className="absolute inset-0 rounded-full border-4 border-primary/10 scale-90 group-hover:scale-100 transition-transform duration-500"></div>
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 640 640"
                                    className="w-14 h-14 text-primary group-hover:text-scheme-c-bg transition-colors duration-300"
                                    aria-hidden="true"
                                >
                                    <path
                                        fill="currentColor"
                                        d="M256 160L256 224L384 224L384 160C384 124.7 355.3 96 320 96C284.7 96 256 124.7 256 160zM192 224L192 160C192 89.3 249.3 32 320 32C390.7 32 448 89.3 448 160L448 224C483.3 224 512 252.7 512 288L512 512C512 547.3 483.3 576 448 576L192 576C156.7 576 128 547.3 128 512L128 288C128 252.7 156.7 224 192 224z"
                                    />
                                </svg>
                            </div>
                            <h3 className="text-xl font-bold mb-3 text-scheme-c-heading">Salvation</h3>
                            <p className="text-sm text-scheme-c-text/70 leading-relaxed">
                                We believe that salvation is by GRACE through FAITH alone, NOT OF WORKS, and the eternal security of the believer (once saved, always saved).
                            </p>
                        </div>

                        {/* Item 3 */}
                        <div className="text-center group">
                            <div className="w-36 h-36 mx-auto mb-6 rounded-full bg-scheme-c-bg/80 border-2 border-primary/30 flex items-center justify-center group-hover:bg-primary group-hover:scale-105 transition-all duration-500 shadow-lg group-hover:shadow-primary/50 relative overflow-hidden">
                                <div className="absolute inset-0 rounded-full border-4 border-primary/10 scale-90 group-hover:scale-100 transition-transform duration-500"></div>
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 640 640"
                                    className="w-14 h-14 text-primary group-hover:text-scheme-c-bg transition-colors duration-300"
                                    aria-hidden="true"
                                >
                                    <path
                                        fill="currentColor"
                                        d="M32 400C32 479.5 96.5 544 176 544L480 544C550.7 544 608 486.7 608 416C608 364.4 577.5 319.9 533.5 299.7C540.2 286.6 544 271.7 544 256C544 203 501 160 448 160C430.3 160 413.8 164.8 399.6 173.1C375.5 127.3 327.4 96 272 96C192.5 96 128 160.5 128 240C128 248 128.7 255.9 129.9 263.5C73 282.7 32 336.6 32 400z"
                                    />
                                </svg>
                            </div>
                            <h3 className="text-xl font-bold mb-3 text-scheme-c-heading">The Trinity</h3>
                            <p className="text-sm text-scheme-c-text/70 leading-relaxed">
                                We believe that God consists of The Father, The Son and The Holy Ghost, that these THREE are ONE (1 John 5:7). Father, Son and Holy Ghost are three DISTINCT persons.
                            </p>
                        </div>

                        {/* Item 4 */}
                        <div className="text-center group">
                            <div className="w-36 h-36 mx-auto mb-6 rounded-full bg-scheme-c-bg/80 border-2 border-primary/30 flex items-center justify-center group-hover:bg-primary group-hover:scale-105 transition-all duration-500 shadow-lg group-hover:shadow-primary/50 relative overflow-hidden">
                                <div className="absolute inset-0 rounded-full border-4 border-primary/10 scale-90 group-hover:scale-100 transition-transform duration-500"></div>
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 640 640"
                                    className="w-14 h-14 text-primary group-hover:text-scheme-c-bg transition-colors duration-300"
                                    aria-hidden="true"
                                >
                                    <path
                                        fill="currentColor"
                                        d="M128 252.6C128 148.4 214 64 320 64C426 64 512 148.4 512 252.6C512 371.9 391.8 514.9 341.6 569.4C329.8 582.2 310.1 582.2 298.3 569.4C248.1 514.9 127.9 371.9 127.9 252.6zM320 320C355.3 320 384 291.3 384 256C384 220.7 355.3 192 320 192C284.7 192 256 220.7 256 256C256 291.3 284.7 320 320 320z"
                                    />
                                </svg>
                            </div>
                            <h3 className="text-xl font-bold mb-3 text-scheme-c-heading">Independent</h3>
                            <p className="text-sm text-scheme-c-text/70 leading-relaxed">
                                We believe only in the LOCAL church, INDEPENDENT and free from outside control NOT depending on another's authority and NOT in a universal church.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* The Bible Way to Heaven */}
            <section id="salvation" className="py-20 bg-scheme-e-bg text-scheme-e-text border-b border-primary/10">
                <div className="container mx-auto px-6">
                    <a
                        target="_blank"
                        rel="noreferrer"
                        href="https://www.kjv1611only.com/video/01salvation/Pastor_Anderson.mp4"
                        className="block text-center"
                    >
                        <h2 className="text-3xl md:text-4xl font-bold mb-2 text-scheme-e-heading">
                            The Bible way <span className="highlight">To Heaven</span>
                        </h2>
                        <p className="text-base md:text-lg text-scheme-e-text/80">
                            <span className="highlight">How you can be 100% sure you're going to Heaven when you die</span>
                        </p>
                    </a>
                    <a target="_blank" rel="noreferrer" href="http://www.romansrd.com" className="block text-center mt-3">
                        <h6 className="text-sm md:text-base text-scheme-e-text/80">
                            New preaching app is out: <span className="highlight">www.romansrd.com</span>
                        </h6>
                    </a>

                    <p className="mt-8 max-w-5xl mx-auto text-base md:text-lg leading-relaxed text-scheme-e-text/80">
                        By following the Bible way to Heaven, we can be ONE HUNDRED PERCENT SURE, that when we die we are going to be with the Lord in Heaven. This is salvation by faith through grace alone, which is ETERNAL, and can never be lost. Salvation is the free gift from God to all men who believe on Jesus for their salvation. Jesus paid for our sins on the cross, died, and was resurrected, so that anyone who believes on him will have everlasting life. (Ephesians 2:8, John 3:16, 1 John 5:13, Romans 3:23)
                    </p>

                    <div className="mt-10 grid grid-cols-1 lg:grid-cols-2 gap-10">
                        <div>
                            <div className="flex flex-wrap gap-2 justify-center lg:justify-start">
                                {salvationTabs.map((tab) => (
                                    <button
                                        key={tab.id}
                                        type="button"
                                        onClick={() => setSalvationTab(tab.id)}
                                        className={`px-3 py-2 text-sm border rounded-md transition-colors ${salvationTab === tab.id
                                            ? 'bg-primary text-white border-primary'
                                            : 'bg-scheme-c-bg/40 text-scheme-e-text border-primary/20 hover:border-primary/60'
                                            }`}
                                    >
                                        {tab.label}
                                    </button>
                                ))}
                            </div>
                            <div className="mt-6 bg-scheme-c-bg/40 border border-primary/10 rounded-lg p-6 text-sm md:text-base leading-relaxed text-scheme-e-text min-h-[240px] md:min-h-[300px]">
                                {salvationTabs.find((tab) => tab.id === salvationTab)?.content}
                            </div>
                        </div>

                        <div className="space-y-3 max-h-[360px] md:max-h-[420px] overflow-auto pr-1">
                            {salvationSteps.map((step) => (
                                <div key={step.label} className="bg-scheme-c-bg/40 border border-primary/10 rounded-lg p-3">
                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between text-xs md:text-sm font-semibold text-scheme-e-heading mb-2 gap-1">
                                        <span>{step.label}</span>
                                        <span className="text-scheme-e-text/70">{step.verse}</span>
                                    </div>
                                    <div className="w-full h-2 bg-scheme-e-bg/60 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-primary"
                                            style={{ width: `${step.percent}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* Resources & Links - Split Layout */}
            <section id="extras" className="bg-scheme-e-bg">
                <div className="container mx-auto">
                    {/* Row 1: Left heavy, Right links */}
                    <div className="flex flex-col md:flex-row border-b border-gray-200 dark:border-gray-800">
                        {/* Left: Download */}
                        <div className="md:w-1/2 p-12 md:p-16 bg-scheme-b-bg text-scheme-b-text flex flex-col justify-center items-start">
                            <h3 className="text-3xl font-bold mb-4 text-scheme-b-heading">Download the Archive</h3>
                            <p className="mb-8 text-scheme-b-text/80 max-w-md">
                                Get a full offline copy of the preaching archive to share or keep safe.
                            </p>
                            <Link href="/download-all" className="bg-white text-scheme-b-bg px-8 py-3 font-bold rounded hover:bg-primary hover:text-white transition-colors">
                                Go to Downloads
                            </Link>
                        </div>
                        {/* Right: Quick Links List */}
                        <div className="md:w-1/2 p-12 md:p-16 flex flex-col justify-center bg-scheme-e-bg text-scheme-e-text">
                            <h3 className="text-2xl font-bold mb-6 text-scheme-e-heading">Quick Resources</h3>
                            <ul className="space-y-4 text-lg">
                                <li>
                                    <Link href="https://www.allthelaws.com/" className="flex items-center group">
                                        <span className="w-2 h-2 bg-primary rounded-full mr-4 group-hover:scale-150 transition-transform"></span>
                                        <span className="group-hover:text-primary transition-colors">Bible Laws Project</span>
                                    </Link>
                                </li>
                                <li>
                                    <Link href="/sw-track" className="flex items-center group">
                                        <span className="w-2 h-2 bg-primary rounded-full mr-4 group-hover:scale-150 transition-transform"></span>
                                        <span className="group-hover:text-primary transition-colors">Soulwinning Tracker</span>
                                    </Link>
                                </li>
                                <li>
                                    <a href="https://bwth.org" target="_blank" className="flex items-center group">
                                        <span className="w-2 h-2 bg-primary rounded-full mr-4 group-hover:scale-150 transition-transform"></span>
                                        <span className="group-hover:text-primary transition-colors">Bible Way to Heaven Resources</span>
                                    </a>
                                </li>
                                <li>
                                    <a href="https://www.faithfulwordbaptist.org/donate.html" target="_blank" className="flex items-center group">
                                        <span className="w-2 h-2 bg-primary rounded-full mr-4 group-hover:scale-150 transition-transform"></span>
                                        <span className="group-hover:text-primary transition-colors">Donate to Faithful Word</span>
                                    </a>
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer Call to Action */}
            <section className="py-16 bg-scheme-e-bg text-center">
                <div className="container mx-auto px-4">
                    <p className="text-scheme-e-text mb-4">Looking for the old site?</p>
                    <a href="https://legacy.allthepreaching.com" className="text-primary font-bold hover:underline">
                        Visit legacy.allthepreaching.com
                    </a>
                </div>
            </section>
        </>
    );
}

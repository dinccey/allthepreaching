/**
 * HeroSection Component
 * Main landing section with headline and call-to-action links
 * Mimics the old site's home section with modern enhancements
 */
import Link from 'next/link';

export default function HeroSection() {
    return (
        <section className="hero-section relative py-20 md:py-32">
            {/* Background gradients (applied via CSS) */}
            <div className="relative z-10 container mx-auto px-4">
                <div className="flex flex-col items-center justify-center text-center space-y-6 animate-fade-in">
                    {/* Main Heading */}
                    <h1 className="text-5xl md:text-7xl font-bold text-white leading-tight">
                        <span className="block">EVERYTHING</span>
                        <span className="highlight text-glow text-6xl md:text-8xl">NIFB</span>
                    </h1>

                    {/* Subtitle */}
                    <p className="text-xl md:text-2xl text-scheme-e-text max-w-4xl">
                        one <span className="highlight text-glow">site</span>
                        {' || '}
                        every <span className="highlight text-glow">video</span>
                        {' || '}
                        all <span className="highlight text-glow">nifb</span>
                    </p>

                    {/* Call to Action Links */}
                    <div className="space-y-4 w-full max-w-2xl pt-8 animate-slide-up">
                        <Link
                            href="/videos?sort=date"
                            className="block group"
                        >
                            <h3 className="text-2xl md:text-3xl text-white hover:text-primary transition-all duration-300 group-hover:scale-105 transform">
                                click here for the <span className="highlight text-glow">newest content</span>
                            </h3>
                        </Link>

                        <div className="space-y-3 pt-4">
                            <Link
                                href="https://www.kjv1611only.com/video/01salvation/Pastor_Anderson.mp4"
                                target="_blank"
                                className="block text-base md:text-lg text-scheme-e-text hover:text-primary transition-colors duration-300"
                            >
                                want to be 100% sure you're going to Heaven? <span className="highlight">click here.</span>
                            </Link>

                            <Link
                                href="https://www.allthelaws.com/"
                                target="_blank"
                                className="block text-base md:text-lg text-scheme-e-text hover:text-primary transition-colors duration-300"
                            >
                                interested in bible laws? check out our new project here: <span className="highlight">allthelaws.com.</span>
                            </Link>

                            <Link
                                href="https://flipbookpdf.net/web/site/8073761ea240888c8d70d8703b267fb30e9f0538202208.pdf.html"
                                target="_blank"
                                className="block text-base md:text-lg text-scheme-e-text hover:text-primary transition-colors duration-300"
                            >
                                download our soulwinning booklet <span className="highlight">click here</span>!
                            </Link>

                            <Link
                                href="/sw-track"
                                className="block text-base md:text-lg text-scheme-e-text hover:text-primary transition-colors duration-300"
                            >
                                want to track your soulwinning dates hours & salvations? <span className="highlight">click here</span>!
                            </Link>

                            <div className="text-base md:text-lg text-scheme-e-text">
                                <Link
                                    href="/download-all"
                                    target="_blank"
                                    className="hover:text-primary transition-colors duration-300"
                                >
                                    <span className="highlight">download all</span>
                                </Link>
                                {' & HAVE a COPY of the archive!'}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}

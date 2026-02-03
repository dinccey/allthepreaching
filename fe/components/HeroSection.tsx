/**
 * HeroSection Component
 * Main landing section with headline and call-to-action links
 * Mimics the old site's home section with modern enhancements
 */
import Link from 'next/link';
import config from '@/config';

export default function HeroSection() {
    return (
        <section className="hero-section relative py-20 md:py-32">
            {/* Background gradients (applied via CSS) */}
            <div className="relative z-10 container mx-auto px-4">
                <div className="flex flex-col items-center justify-center text-center space-y-6 animate-fade-in">
                    {/* Main Heading */}
                    <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-scheme-e-heading leading-tight whitespace-nowrap">
                        <span className="hero-title">EVERYTHING</span> <span className="highlight text-glow">NIFB</span>
                    </h1>

                    <Link
                        href={config.site.salvationVideoPath}
                        className="text-base md:text-lg text-scheme-e-text hover:text-primary transition-colors duration-300"
                    >
                        Want to be 100% sure you're going to Heaven? <span className="highlight">click here.</span>
                    </Link>
                </div>
            </div>
        </section>
    );
}

/**
 * Footer component
 * Redesigned to match old site's style with back-to-top functionality
 */
import Link from 'next/link';
import { useState, useEffect } from 'react';
import config from '@/config';

export default function Footer() {
    const [showBackToTop, setShowBackToTop] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            setShowBackToTop(window.scrollY > 400);
        };

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const scrollToTop = () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    return (
        <>
            {/* Back to Top Button (floating) */}
            {showBackToTop && (
                <button
                    onClick={scrollToTop}
                    className="fixed bottom-8 right-8 z-30 
                             bg-primary hover:bg-primary-600 
                             text-scheme-c-bg 
                             p-4 rounded-full shadow-2xl 
                             transition-all duration-300 
                             hover:scale-110 active:scale-95
                             animate-fade-in"
                    aria-label="Back to top"
                >
                    <svg
                        className="w-6 h-6"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 10l7-7m0 0l7 7m-7-7v18"
                        />
                    </svg>
                </button>
            )}

            {/* Footer */}
            <footer className="bg-scheme-e-bg border-t border-primary/20">
                {/* Top section - Back to Top & Email */}
                <div className="bg-scheme-e-bg/95 backdrop-blur-md py-4 border-b border-primary/10">
                    <div className="container mx-auto px-4">
                        <div className="flex flex-col md:flex-row items-center justify-center gap-4 text-scheme-e-text text-center">
                            <button
                                onClick={scrollToTop}
                                className="hover:text-primary transition-colors duration-300"
                            >
                                Back <span className="highlight">To Top</span>
                            </button>
                            <span className="hidden md:inline">|</span>
                            <a
                                href="mailto:admin@allthepreaching.com"
                                className="hover:text-primary transition-colors duration-300"
                            >
                                email us <span className="highlight">admin@allthepreaching.com</span>
                            </a>
                        </div>
                    </div>
                </div>

                {/* Main Footer Content */}
                <div className="py-12">
                    <div className="container mx-auto px-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
                            {/* About */}
                            <div className="space-y-3">
                                <h3 className="font-bold text-xl text-white mb-4">
                                    <span className="highlight">ALL</span>THE<span className="highlight">PREACHING</span>
                                </h3>
                                <p className="text-scheme-e-text leading-relaxed">
                                    Everything NIFB. One site, every video, all NIFB preaching archived
                                    and organized for your edification.
                                </p>
                            </div>

                            {/* Quick Links */}
                            <div>
                                <h3 className="font-bold text-lg text-white mb-4">Quick Links</h3>
                                <ul className="space-y-2">
                                    <li>
                                        <Link
                                            href="/"
                                            className="text-scheme-e-text hover:text-primary transition-colors duration-300"
                                        >
                                            Home
                                        </Link>
                                    </li>
                                    <li>
                                        <Link
                                            href="/preachers"
                                            className="text-scheme-e-text hover:text-primary transition-colors duration-300"
                                        >
                                            Preachers
                                        </Link>
                                    </li>
                                    <li>
                                        <Link
                                            href="/videos"
                                            className="text-scheme-e-text hover:text-primary transition-colors duration-300"
                                        >
                                            Videos
                                        </Link>
                                    </li>
                                    <li>
                                        <Link
                                            href="/search"
                                            className="text-scheme-e-text hover:text-primary transition-colors duration-300"
                                        >
                                            Search
                                        </Link>
                                    </li>
                                    <li>
                                        <Link
                                            href="/videos"
                                            className="text-scheme-e-text hover:text-primary transition-colors duration-300"
                                        >
                                            RSS Feed
                                        </Link>
                                    </li>
                                </ul>
                            </div>

                            {/* Resources & Categories */}
                            <div>
                                <h3 className="font-bold text-lg text-white mb-4">Categories</h3>
                                <ul className="space-y-2">
                                    <li>
                                        <Link
                                            href={config.site.salvationVideoPath}
                                            className="text-scheme-e-text hover:text-primary transition-colors duration-300"
                                        >
                                            Salvation
                                        </Link>
                                    </li>
                                    <li>
                                        <Link
                                            href="/category/documentaries"
                                            className="text-scheme-e-text hover:text-primary transition-colors duration-300"
                                        >
                                            Documentaries
                                        </Link>
                                    </li>
                                    <li>
                                        <Link
                                            href="/download-all"
                                            className="text-scheme-e-text hover:text-primary transition-colors duration-300"
                                        >
                                            Download All
                                        </Link>
                                    </li>
                                </ul>
                            </div>
                        </div>

                        {/* Copyright & Attribution */}
                        <div className="border-t border-primary/10 pt-8 text-center space-y-2">
                            <p className="text-scheme-e-text">
                                &copy; {new Date().getFullYear()} ALLthePREACHING.com. All rights reserved.
                            </p>
                            <p className="text-primary text-sm">
                                King James Bible - The preserved Word of God
                            </p>
                            <p className="text-scheme-e-text/70 text-xs">
                                Made with faith for the glory of God
                            </p>
                        </div>
                    </div>
                </div>
            </footer>
        </>
    );
}

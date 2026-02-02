/**
 * Header/Navigation component
 * Redesigned to match the old site's style with modern enhancements
 * Unified menu across all pages with search integration
 */
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import DualSearchBar from './DualSearchBar';

export default function Header() {
    const [menuOpen, setMenuOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const router = useRouter();

    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 20);
        };

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // Close mobile menu on route change
    useEffect(() => {
        setMenuOpen(false);
    }, [router.pathname]);

    return (
        <header
            className={`navbar fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${scrolled ? 'shadow-2xl' : ''
                }`}
        >
            <div className="container mx-auto px-4">
                {/* Main Navigation Bar */}
                <div className="flex items-center justify-between h-20">
                    {/* Logo */}
                    <Link href="/" className="flex items-center group">
                        <h1 className="text-xl md:text-2xl font-bold text-white">
                            <span className="highlight text-glow transition-all duration-300 group-hover:scale-110 inline-block">
                                ALL
                            </span>
                            <span className="transition-colors duration-300">THE</span>
                            <span className="highlight text-glow transition-all duration-300 group-hover:scale-110 inline-block">
                                PREACHING
                            </span>
                        </h1>
                    </Link>

                    {/* Desktop Navigation */}
                    <nav className="hidden lg:flex items-center space-x-1">
                        <Link href="/" className="nav-link">
                            Home
                        </Link>
                        <Link href="/latest" className="nav-link">
                            Latest
                        </Link>
                        <Link href="/videos" className="nav-link">
                            Videos
                        </Link>
                        <Link href="/preachers" className="nav-link">
                            Preachers
                        </Link>
                        <Link href="/#extras" className="nav-link">
                            Extras
                        </Link>
                        <Link href="/video/7314489" className="nav-link">
                            Salvation
                        </Link>
                    </nav>

                    {/* Mobile Menu Toggle */}
                    <button
                        className="lg:hidden flex flex-col justify-center items-center w-10 h-10 space-y-1.5 group"
                        onClick={() => setMenuOpen(!menuOpen)}
                        aria-label="Toggle menu"
                    >
                        <span
                            className={`block w-6 h-0.5 bg-primary transition-all duration-300 ${menuOpen ? 'rotate-45 translate-y-2' : ''
                                }`}
                        />
                        <span
                            className={`block w-6 h-0.5 bg-primary transition-all duration-300 ${menuOpen ? 'opacity-0' : ''
                                }`}
                        />
                        <span
                            className={`block w-6 h-0.5 bg-primary transition-all duration-300 ${menuOpen ? '-rotate-45 -translate-y-2' : ''
                                }`}
                        />
                    </button>
                </div>

                {/* Search Bar - Always visible on desktop, in mobile menu for mobile */}
                <div className="hidden lg:block pb-4 animate-slide-in-left">
                    <DualSearchBar />
                </div>

                {/* Mobile Menu */}
                <div
                    className={`lg:hidden transition-all duration-300 overflow-hidden ${menuOpen ? 'max-h-screen opacity-100 pb-6' : 'max-h-0 opacity-0'
                        }`}
                >
                    <nav className="flex flex-col space-y-3 pt-4 border-t border-primary/20">
                        <Link
                            href="/"
                            className="text-scheme-e-text hover:text-primary transition-colors py-2"
                        >
                            Home
                        </Link>
                        <Link
                            href="/#boldmen"
                            className="text-scheme-e-text hover:text-primary transition-colors py-2"
                        >
                            Bold Men
                        </Link>
                        <Link
                            href="/#whoweare"
                            className="text-scheme-e-text hover:text-primary transition-colors py-2"
                        >
                            We Are
                        </Link>
                        <Link
                            href="/video/7314489"
                            className="text-scheme-e-text hover:text-primary transition-colors py-2"
                        >
                            Salvation
                        </Link>
                        <Link
                            href="/videos"
                            className="text-scheme-e-text hover:text-primary transition-colors py-2"
                        >
                            Videos
                        </Link>
                        <Link
                            href="/latest"
                            className="text-scheme-e-text hover:text-primary transition-colors py-2"
                        >
                            Latest
                        </Link>
                        <Link
                            href="/preachers"
                            className="text-scheme-e-text hover:text-primary transition-colors py-2"
                        >
                            Preachers
                        </Link>
                        <Link
                            href="/#extras"
                            className="text-scheme-e-text hover:text-primary transition-colors py-2"
                        >
                            Extras
                        </Link>

                        {/* Mobile Search */}
                        <div className="pt-4">
                            <DualSearchBar />
                        </div>
                    </nav>
                </div>
            </div>
        </header>
    );
}

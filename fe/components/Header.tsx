/**
 * Header/Navigation component
 * Redesigned to match the old site's style with modern enhancements
 * Unified menu across all pages with search integration
 */
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import DualSearchBar from './DualSearchBar';
import config from '@/config';

export default function Header() {
    const [menuOpen, setMenuOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const [canGoBack, setCanGoBack] = useState(false);
    const router = useRouter();

    const navItems = [
        { href: '/', label: 'Home' },
        { href: '/videos', label: 'Videos' },
        { href: '/preachers', label: 'Preachers' },
        { href: '/#extras', label: 'Extras' },
        { href: config.site.salvationVideoPath, label: 'Salvation' },
    ];

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

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const historyHasBack = window.history.length > 1;
        const notHome = router.pathname !== '/';
        setCanGoBack(historyHasBack && notHome);
    }, [router.pathname, router.asPath]);

    const isActiveNavItem = (href: string) => {
        if (href.startsWith('http')) return false;
        if (href === '/') {
            return router.pathname === '/';
        }
        if (href.startsWith('/#')) {
            return router.pathname === '/' && router.asPath.startsWith(href);
        }
        return router.asPath === href || router.asPath.startsWith(`${href}?`) || router.pathname.startsWith(href);
    };

    return (
        <header
            className={`navbar fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${scrolled ? 'shadow-2xl' : ''
                }`}
        >
            <div className="container mx-auto px-4">
                {/* Main Navigation Bar */}
                <div className="flex items-center justify-between h-20">
                    {/* Back + Logo */}
                    <div className="flex items-center">
                        {canGoBack && (
                            <button
                                type="button"
                                onClick={() => router.back()}
                                className="mr-2 inline-flex h-9 w-9 items-center justify-center rounded-full border border-secondary-dark/40 bg-scheme-c-bg/40 text-primary transition-all duration-200 hover:bg-scheme-b-bg/60 hover:text-primary"
                                aria-label="Go back"
                            >
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    viewBox="0 0 256 512"
                                    className="h-4 w-4 text-primary dark:text-primary-400"
                                    aria-hidden="true"
                                    focusable="false"
                                >
                                    <path
                                        fill="currentColor"
                                        d="M9.4 233.4c-12.5 12.5-12.5 32.8 0 45.3l160 160c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L77.3 256 214.6 118.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0l-160 160z"
                                    />
                                </svg>
                            </button>
                        )}
                        <Link
                            href="/"
                            className={`logo-link flex items-center transition-transform duration-200 ease-out ${canGoBack ? 'translate-x-1' : ''}`}
                            onTouchEnd={(event) => (event.currentTarget as HTMLAnchorElement).blur()}
                            onTouchCancel={(event) => (event.currentTarget as HTMLAnchorElement).blur()}
                        >
                            <h1 className="text-xl md:text-2xl font-bold text-scheme-e-heading">
                                <span className="logo-all highlight text-glow">
                                    ALL
                                </span>
                                <span className="logo-mid transition-colors duration-300">THE</span>
                                <span className="logo-preaching highlight text-glow">
                                    PREACHING
                                </span>
                            </h1>
                        </Link>
                    </div>

                    {/* Desktop Navigation */}
                    <nav className="hidden lg:flex items-center space-x-1">
                        {navItems.map((item) => {
                            const isActive = isActiveNavItem(item.href);
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={`nav-link ${isActive ? 'text-primary bg-scheme-b-bg/60 after:scale-x-100' : ''}`}
                                >
                                    {item.label}
                                </Link>
                            );
                        })}
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
                    <nav className="flex flex-col items-center space-y-4 pt-4 border-t border-primary/20 text-center">
                        {/* Mobile Search */}
                        <div className="w-full px-2">
                            <DualSearchBar />
                        </div>

                        {navItems.map((item) => {
                            const isActive = isActiveNavItem(item.href);
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={`text-scheme-e-text hover:text-primary transition-colors py-2 text-lg font-semibold ${isActive ? 'text-primary' : ''}`}
                                >
                                    {item.label}
                                </Link>
                            );
                        })}
                    </nav>
                </div>
            </div>
        </header>
    );
}

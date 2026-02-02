/**
 * Header/Navigation component
 * Consistent menu across all pages
 */
import Link from 'next/link';
import { useState } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import SearchBar from './SearchBar';

export default function Header() {
    const [menuOpen, setMenuOpen] = useState(false);
    const { theme, toggleTheme } = useTheme();

    return (
        <header className="bg-white dark:bg-dark-card shadow-md sticky top-0 z-50">
            <div className="container mx-auto px-4">
                <div className="flex items-center justify-between h-16">
                    {/* Logo */}
                    <Link href="/" className="flex items-center space-x-2">
                        <h1 className="text-xl md:text-2xl font-bold text-primary-800 dark:text-primary-400">
                            # ALLthePREACHING
                        </h1>
                    </Link>

                    {/* Desktop Navigation */}
                    <nav className="hidden md:flex items-center space-x-6">
                        <Link href="/" className="hover:text-primary-600 dark:hover:text-primary-400 transition-colors">
                            Home
                        </Link>
                        <Link href="/preachers" className="hover:text-primary-600 dark:hover:text-primary-400 transition-colors">
                            Preachers
                        </Link>

                        {/* Categories Dropdown */}
                        <div className="relative group">
                            <button className="hover:text-primary-600 dark:hover:text-primary-400 transition-colors">
                                Categories
                            </button>
                            <div className="absolute top-full left-0 mt-2 w-48 bg-white dark:bg-dark-card shadow-lg rounded-lg py-2 hidden group-hover:block">
                                <Link href="/category/salvation" className="block px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700">
                                    Salvation
                                </Link>
                                <Link href="/category/hard-preaching" className="block px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700">
                                    Hard Preaching
                                </Link>
                                <Link href="/category/documentaries" className="block px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700">
                                    Documentaries
                                </Link>
                            </div>
                        </div>

                        <Link href="/about" className="hover:text-primary-600 dark:hover:text-primary-400 transition-colors">
                            About
                        </Link>
                    </nav>

                    {/* Search and Theme Toggle */}
                    <div className="hidden md:flex items-center space-x-4">
                        <SearchBar />

                        <button
                            onClick={toggleTheme}
                            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            aria-label="Toggle theme"
                        >
                            {theme === 'light' ? (
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                                </svg>
                            ) : (
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
                                </svg>
                            )}
                        </button>
                    </div>

                    {/* Mobile Menu Button */}
                    <button
                        className="md:hidden p-2"
                        onClick={() => setMenuOpen(!menuOpen)}
                        aria-label="Toggle menu"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            {menuOpen ? (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            ) : (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                            )}
                        </svg>
                    </button>
                </div>

                {/* Mobile Menu */}
                {menuOpen && (
                    <div className="md:hidden py-4 border-t dark:border-gray-700">
                        <nav className="flex flex-col space-y-3">
                            <Link href="/" className="hover:text-primary-600 dark:hover:text-primary-400">
                                Home
                            </Link>
                            <Link href="/preachers" className="hover:text-primary-600 dark:hover:text-primary-400">
                                Preachers
                            </Link>
                            <Link href="/category/salvation" className="hover:text-primary-600 dark:hover:text-primary-400 pl-4">
                                Salvation
                            </Link>
                            <Link href="/category/hard-preaching" className="hover:text-primary-600 dark:hover:text-primary-400 pl-4">
                                Hard Preaching
                            </Link>
                            <Link href="/category/documentaries" className="hover:text-primary-600 dark:hover:text-primary-400 pl-4">
                                Documentaries
                            </Link>
                            <Link href="/about" className="hover:text-primary-600 dark:hover:text-primary-400">
                                About
                            </Link>

                            <div className="pt-3">
                                <SearchBar />
                            </div>

                            <button
                                onClick={toggleTheme}
                                className="flex items-center space-x-2 hover:text-primary-600 dark:hover:text-primary-400"
                            >
                                <span>Toggle {theme === 'light' ? 'Dark' : 'Light'} Mode</span>
                            </button>
                        </nav>
                    </div>
                )}
            </div>
        </header>
    );
}

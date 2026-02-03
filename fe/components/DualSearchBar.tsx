/**
 * DualSearchBar Component
 * Two search inputs matching the old site's design
 * First input: searches categories, preachers, and titles
 * Second input: searches media content
 * Prepared for future unified search with advanced options
 */
import { useState } from 'react';
import { useRouter } from 'next/router';

interface DualSearchBarProps {
    onSearch?: (basicQuery: string, advancedQuery: string) => void;
    className?: string;
}

export default function DualSearchBar({ onSearch, className = '' }: DualSearchBarProps) {
    const router = useRouter();
    const [basicSearch, setBasicSearch] = useState('');
    const [advancedSearch, setAdvancedSearch] = useState('');
    const [showInfo, setShowInfo] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (onSearch) {
            onSearch(basicSearch, advancedSearch);
        } else {
            // Navigate to search page with query parameters
            const params = new URLSearchParams();
            if (basicSearch) params.set('search', basicSearch);
            if (advancedSearch) params.set('advanced-search', advancedSearch);
            router.push(`/search?${params.toString()}`);
        }
    };

    return (
        <div className={`search-box-container w-full ${className}`}>
            <form onSubmit={handleSubmit} className="flex flex-col items-center w-full space-y-3">
                {/* Search Input Container */}
                <div className="flex flex-col md:flex-row md:items-center w-full max-w-4xl gap-3 animate-slide-in-left">
                    <div className="flex flex-col w-full flex-1 gap-3 md:flex-row">
                        <div className="flex items-center gap-3 w-full md:flex-1">
                            {/* Basic Search Input */}
                            <input
                                type="text"
                                value={basicSearch}
                                onChange={(e) => setBasicSearch(e.target.value)}
                                placeholder="Search preachers, categories and/or titles..."
                                className="search-input w-full"
                            />

                            {/* Info Button */}
                            <button
                                type="button"
                                onClick={() => setShowInfo(!showInfo)}
                                className="shrink-0 p-3 rounded-full bg-transparent border-2 border-secondary
                                 hover:bg-secondary hover:border-primary
                                 transition-all duration-300 hover:scale-110 active:scale-95
                                 group relative"
                                aria-label="Search information"
                            >
                                <svg
                                    width="24"
                                    height="24"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    xmlns="http://www.w3.org/2000/svg"
                                >
                                    <circle
                                        cx="12"
                                        cy="12"
                                        r="10"
                                        className="stroke-primary group-hover:stroke-white transition-colors duration-300"
                                        strokeWidth="2"
                                    />
                                    <line
                                        x1="12"
                                        y1="16"
                                        x2="12"
                                        y2="12"
                                        className="stroke-primary group-hover:stroke-white transition-colors duration-300"
                                        strokeWidth="2"
                                    />
                                    <line
                                        x1="12"
                                        y1="8"
                                        x2="12"
                                        y2="10"
                                        className="stroke-primary group-hover:stroke-white transition-colors duration-300"
                                        strokeWidth="2"
                                    />
                                </svg>
                            </button>
                        </div>

                        <div className="flex items-center gap-3 w-full md:flex-1">
                            {/* Advanced Search Input */}
                            <input
                                type="text"
                                value={advancedSearch}
                                onChange={(e) => setAdvancedSearch(e.target.value)}
                                placeholder="Search media content..."
                                className="search-input w-full"
                            />

                            {/* Search Button */}
                            <button
                                type="submit"
                                className="shrink-0 p-3 rounded-full bg-transparent border-2 border-secondary
                                 hover:bg-secondary hover:border-primary
                                 transition-all duration-300 hover:scale-110 active:scale-95
                                 group"
                                aria-label="Search"
                            >
                                <svg
                                    width="24"
                                    height="24"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="transition-colors duration-300"
                                >
                                    <path
                                        d="M11 6C13.7614 6 16 8.23858 16 11M16.6588 16.6549L21 21M19 11C19 15.4183 15.4183 19 11 19C6.58172 19 3 15.4183 3 11C3 6.58172 6.58172 3 11 3C15.4183 3 19 6.58172 19 11Z"
                                        stroke="currentColor"
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        className="stroke-primary group-hover:stroke-white transition-colors duration-300"
                                    />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Info Popup */}
                {showInfo && (
                    <div
                        className="fixed top-20 right-4 md:right-10 z-50 max-w-md 
                                 bg-primary text-scheme-c-bg p-6 rounded-2xl 
                                 border-2 border-primary shadow-2xl
                                 animate-scale-in backdrop-blur-md"
                        onClick={() => setShowInfo(false)}
                    >
                        <button
                            onClick={() => setShowInfo(false)}
                            className="absolute top-2 right-2 text-2xl hover:scale-110 transition-transform"
                            aria-label="Close"
                        >
                            &times;
                        </button>
                        <div className="space-y-3 text-sm leading-relaxed pt-2">
                            <p className="font-semibold">How to use the dual search:</p>
                            <p>
                                The <strong>first input</strong> matches category information that usually includes
                                category (sermons, clips, other, docs), preacher (by last name) and just general
                                video/sermon title.
                            </p>
                            <p>
                                The <strong>second input</strong> matches the content of the media. A maximum of
                                300 results are returned per search query for performance reasons.
                            </p>
                            <p className="italic">
                                Use both input fields together or each independently to suit your needs.
                            </p>
                            <p className="text-xs mt-4 opacity-80">
                                💡 Future update will include unified search with advanced filtering options.
                            </p>
                        </div>
                    </div>
                )}

                {/* Search Label (optional, for consistency with old site) */}
                {/* <div className="text-primary text-xl md:text-2xl font-bold text-center drop-shadow-md">
                    Search the Archive
                </div> */}
            </form>
        </div>
    );
}

/**
 * Search bar component
 * Real-time search with debouncing
 */
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';

export default function SearchBar() {
    const [query, setQuery] = useState('');
    const [isFocused, setIsFocused] = useState(false);
    const router = useRouter();
    const inputRef = useRef<HTMLInputElement>(null);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (query.trim()) {
            router.push(`/search?q=${encodeURIComponent(query.trim())}`);
            setIsFocused(false);
            inputRef.current?.blur();
        }
    };

    return (
        <form onSubmit={handleSearch} className="relative w-full md:w-64">
            <input
                ref={inputRef}
                type="text"
                placeholder="Search videos..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setTimeout(() => setIsFocused(false), 200)}
                className="w-full px-4 py-2 pl-10 rounded-lg border-2 border-gray-400 dark:border-gray-500 bg-gray-200 dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 focus:bg-gray-300 dark:focus:bg-gray-600 transition-all duration-200 text-gray-900 dark:text-gray-100"
            />

            <svg
                className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
            >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
        </form>
    );
}

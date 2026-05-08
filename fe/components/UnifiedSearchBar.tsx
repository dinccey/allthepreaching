/**
 * UnifiedSearchBar
 * Single search bar with mode toggle: Videos / Captions / All.
 * Replaces both SearchBar and DualSearchBar.
 *
 * compact={true}  → header / nav use (narrower, Enter-only submit)
 * compact={false} → search results page (wider, pre-populated from URL, with submit button)
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import type { ReactElement } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/router';

export type SearchMode = 'videos' | 'subtitles' | 'all';

interface UnifiedSearchBarProps {
    compact?: boolean;
    className?: string;
}

const MODES: { value: SearchMode; label: string }[] = [
    { value: 'videos',    label: 'Videos'   },
    { value: 'subtitles', label: 'Captions' },
    { value: 'all',       label: 'All'      },
];

export default function UnifiedSearchBar({ compact = false, className = '' }: UnifiedSearchBarProps) {
    const router = useRouter();
    const inputRef = useRef<HTMLInputElement>(null);
    const infoRef = useRef<HTMLDivElement>(null);
    const infoBtnRef = useRef<HTMLButtonElement>(null);
    const [query, setQuery] = useState('');
    const [mode, setMode] = useState<SearchMode>('all');
    const [showInfo, setShowInfo] = useState(false);
    const [panelPos, setPanelPos] = useState<{ top: number; right: number }>({ top: 0, right: 0 });

    // Close info panel on outside click
    const handleDocClick = useCallback((e: MouseEvent) => {
        if (
            infoRef.current && !infoRef.current.contains(e.target as Node) &&
            infoBtnRef.current && !infoBtnRef.current.contains(e.target as Node)
        ) {
            setShowInfo(false);
        }
    }, []);

    const toggleInfo = useCallback(() => {
        if (!showInfo && infoBtnRef.current) {
            const r = infoBtnRef.current.getBoundingClientRect();
            setPanelPos({
                top: r.bottom + 8,
                right: window.innerWidth - r.right,
            });
        }
        setShowInfo(v => !v);
    }, [showInfo]);

    useEffect(() => {
        if (showInfo) {
            document.addEventListener('mousedown', handleDocClick);
        } else {
            document.removeEventListener('mousedown', handleDocClick);
        }
        return () => document.removeEventListener('mousedown', handleDocClick);
    }, [showInfo, handleDocClick]);

    // Sync state with URL when on search page (or any page with search params)
    useEffect(() => {
        if (!router.isReady) return;
        const { q, search, 'advanced-search': advSearch, mode: modeParam } = router.query;

        const currentQ =
            typeof q === 'string' ? q :
            typeof search === 'string' ? search :
            typeof advSearch === 'string' ? advSearch : '';
        setQuery(currentQ);

        if (modeParam === 'videos' || modeParam === 'subtitles' || modeParam === 'all') {
            setMode(modeParam as SearchMode);
        } else if (typeof advSearch === 'string' && advSearch) {
            setMode('subtitles');
        } else {
            setMode('all');
        }
    }, [router.isReady, router.query]);

    const navigate = (q: string, m: SearchMode) => {
        const params = new URLSearchParams();
        params.set('q', q);
        if (m !== 'all') params.set('mode', m);
        router.push(`/search?${params.toString()}`);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = query.trim();
        if (!trimmed) return;
        navigate(trimmed, mode);
        inputRef.current?.blur();
    };

    const handleModeChange = (newMode: SearchMode) => {
        setMode(newMode);
        // If already on search page with a query, switch results immediately
        if (router.pathname === '/search' && query.trim()) {
            navigate(query.trim(), newMode);
        }
    };

    // Icons for each mode (compact in-input buttons)
    const ModeIcons: Record<SearchMode, ReactElement> = {
        videos: (
            // Film / video camera
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M15 10l4.553-2.276A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14M4 8h11a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1V9a1 1 0 011-1z"
                    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" stroke="currentColor" />
            </svg>
        ),
        subtitles: (
            // Closed-caption / subtitle lines
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <rect x="2" y="5" width="20" height="14" rx="2" strokeWidth="2" stroke="currentColor" />
                <line x1="6" y1="10" x2="14" y2="10" strokeWidth="2" strokeLinecap="round" stroke="currentColor" />
                <line x1="6" y1="14" x2="18" y2="14" strokeWidth="2" strokeLinecap="round" stroke="currentColor" />
            </svg>
        ),
        all: (
            // 2×2 grid (all / everything)
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <rect x="3" y="3" width="7" height="7" rx="1" strokeWidth="2" stroke="currentColor" />
                <rect x="14" y="3" width="7" height="7" rx="1" strokeWidth="2" stroke="currentColor" />
                <rect x="3" y="14" width="7" height="7" rx="1" strokeWidth="2" stroke="currentColor" />
                <rect x="14" y="14" width="7" height="7" rx="1" strokeWidth="2" stroke="currentColor" />
            </svg>
        ),
    };

    const placeholder =
        mode === 'subtitles' ? 'Search sermon captions...' :
        mode === 'all' ? 'Search everything...' :
        'Search videos...';

    return (
        <form
            onSubmit={handleSubmit}
            className={`flex flex-col gap-2 ${compact ? 'w-full' : 'w-full max-w-2xl mx-auto'} ${className}`}
        >
            {/* Input row */}
            <div className="relative flex items-center gap-2">
                <div className="relative flex-1">
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder={placeholder}
                        className={`search-input pl-3 ${compact ? 'pr-[6.5rem] py-2 text-sm' : `${query ? 'pr-9' : 'pr-4'} py-3 text-base`}`}
                        autoComplete="off"
                        spellCheck={false}
                        aria-label="Search"
                    />
                    {/* Right-side overlay: clear button + compact mode icons */}
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                        {query && (
                            <button
                                type="button"
                                onClick={() => { setQuery(''); inputRef.current?.focus(); }}
                                className="text-secondary-light/60 hover:text-primary transition-colors duration-150 p-0.5"
                                aria-label="Clear search"
                            >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        )}
                        {compact && (
                            <>
                                <div className="w-px h-4 bg-secondary-dark/40 mx-0.5" aria-hidden="true" />
                                {MODES.map(({ value }) => (
                                    <button
                                        key={value}
                                        type="button"
                                        onClick={() => handleModeChange(value)}
                                        title={value.charAt(0).toUpperCase() + value.slice(1)}
                                        aria-pressed={mode === value}
                                        aria-label={value}
                                        className={`p-1 rounded transition-colors duration-150 ${
                                            mode === value
                                                ? 'text-primary'
                                                : 'text-secondary-light/50 hover:text-primary/70'
                                        }`}
                                    >
                                        {ModeIcons[value]}
                                    </button>
                                ))}
                            </>
                        )}
                    </div>
                </div>

                {/* Submit button — compact icon, no border */}
                <button
                    type="submit"
                    className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full
                               text-primary/70 hover:text-primary hover:bg-primary/10
                               transition-colors duration-200 active:scale-95"
                    aria-label="Search"
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path
                            d="M11 6C13.7614 6 16 8.23858 16 11M16.6588 16.6549L21 21M19 11C19 15.4183 15.4183 19 11 19C6.58172 19 3 15.4183 3 11C3 6.58172 6.58172 3 11 3C15.4183 3 19 6.58172 19 11Z"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            stroke="currentColor"
                        />
                    </svg>
                </button>

                {/* Info button — small, unobtrusive */}
                <div className="shrink-0">
                    <button
                        ref={infoBtnRef}
                        type="button"
                        onClick={toggleInfo}
                        className="w-6 h-6 flex items-center justify-center rounded-full
                                   text-secondary-light/50 hover:text-primary
                                   transition-colors duration-200"
                        aria-label="Search tips"
                        aria-expanded={showInfo}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <circle cx="12" cy="12" r="10" strokeWidth="2" stroke="currentColor" />
                            <line x1="12" y1="11" x2="12" y2="16" strokeWidth="2" strokeLinecap="round" stroke="currentColor" />
                            <circle cx="12" cy="8" r="1" fill="currentColor" />
                        </svg>
                    </button>
                </div>

                {/* Info panel — rendered as a portal so it overlays everything including clipped headers */}
                {showInfo && typeof document !== 'undefined' && createPortal(
                    <div
                        ref={infoRef}
                        style={{ position: 'fixed', top: panelPos.top, right: panelPos.right, zIndex: 9999 }}
                        className="w-80 bg-primary text-scheme-c-bg p-5 rounded-2xl
                                   border-2 border-primary shadow-2xl animate-scale-in"
                    >
                        <button
                            type="button"
                            onClick={() => setShowInfo(false)}
                            className="absolute top-2 right-3 text-xl leading-none hover:scale-110 transition-transform"
                            aria-label="Close"
                        >
                            &times;
                        </button>
                        <div className="space-y-3 text-sm leading-relaxed pt-1">
                            <p className="font-semibold text-base">Search tips</p>

                            <div>
                                <p className="font-semibold mb-1">Modes</p>
                                <ul className="space-y-1 opacity-90">
                                    <li><strong>Videos</strong> — matches title, preacher &amp; category</li>
                                    <li><strong>Captions</strong> — searches full sermon transcripts</li>
                                    <li><strong>All</strong> — shows both results side by side</li>
                                </ul>
                            </div>

                            <div>
                                <p className="font-semibold mb-1">Advanced syntax</p>
                                <ul className="space-y-1 opacity-90 font-mono text-xs">
                                    <li><span className="font-bold">&quot;exact phrase&quot;</span> <span className="font-sans font-normal">— match words in order</span></li>
                                    <li><span className="font-bold">&quot;grace or faith&quot;</span> <span className="font-sans font-normal">— literal phrase with &quot;or&quot;</span></li>
                                    <li><span className="font-bold">-word</span> <span className="font-sans font-normal">— exclude a word</span></li>
                                    <li><span className="font-bold">grace OR faith</span> <span className="font-sans font-normal">— either term (or/OR both work)</span></li>
                                    <li><span className="font-bold">grace faith</span> <span className="font-sans font-normal">— both words (AND)</span></li>
                                </ul>
                            </div>

                            <p className="text-xs opacity-75 pt-1">
                                <span className="font-mono">or</span> and <span className="font-mono">OR</span> are both treated as the OR operator. Use quotes to search literally: <span className="font-mono">&quot;word or word&quot;</span>.
                            </p>
                            <p className="text-xs opacity-75">
                                Captions search covers all indexed sermon transcripts. Results are ranked by match frequency.
                            </p>
                        </div>
                    </div>,
                    document.body
                )}
            </div>

            {/* Mode pills — full mode only (compact mode uses icon buttons inside the input) */}
            {!compact && (
            <div className="flex items-center gap-1.5 justify-center">
                {MODES.map(({ value, label }) => (
                    <button
                        key={value}
                        type="button"
                        onClick={() => handleModeChange(value)}
                        className={`
                            text-xs font-semibold px-3 py-1 rounded-full border transition-all duration-200
                            ${mode === value
                                ? 'bg-primary/20 border-primary text-primary'
                                : 'border-secondary-dark/40 text-secondary-light/70 hover:border-primary/50 hover:text-primary/80'
                            }
                        `}
                        aria-pressed={mode === value}
                    >
                        {label}
                    </button>
                ))}
            </div>
            )}
        </form>
    );
}

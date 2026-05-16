/**
 * Search results page — unified mode (Videos / Captions / All)
 */
import { useRouter } from 'next/router';
import Head from 'next/head';
import { useMemo, useState, useEffect, useRef } from 'react';
import api from '@/lib/api';
import VideoCard from '@/components/VideoCard';
import CompactVideoCard from '@/components/CompactVideoCard';
import SubtitlesResultCard from '@/components/search/SubtitlesResultCard';
import { type SearchMode } from '@/components/UnifiedSearchBar';

const PAGE_SIZE_VIDEOS = 24;
const PAGE_SIZE_SUBTITLES = 50;
const ALL_MODE_VIDEO_LIMIT = 12;
const ALL_MODE_SUBTITLE_LIMIT = 20;

export default function SearchPage() {
    const router = useRouter();

    // --- URL params (backward-compat: q / search / advanced-search / mode / page) ---
    const query = useMemo(() => {
        const { q, search, 'advanced-search': adv } = router.query;
        return typeof q === 'string' ? q
            : typeof search === 'string' ? search
            : typeof adv === 'string' ? adv
            : '';
    }, [router.query]);

    const urlMode = useMemo<SearchMode>(() => {
        const { mode, 'advanced-search': adv } = router.query;
        if (mode === 'videos' || mode === 'subtitles' || mode === 'all') return mode as SearchMode;
        if (typeof adv === 'string' && adv) return 'subtitles';
        return 'all';
    }, [router.query]);

    const currentPage = useMemo(() => {
        const p = parseInt(router.query.page as string, 10);
        return Number.isNaN(p) || p < 0 ? 0 : p;
    }, [router.query.page]);

    // Preacher/category filter (captions only) — ?preacher=slug1,slug2 (comma-separated multi-select)
    const preacherFilters = useMemo(() => {
        const { preacher } = router.query;
        if (typeof preacher !== 'string' || !preacher.trim()) return [] as string[];
        return preacher.split(',').map(s => s.trim()).filter(Boolean);
    }, [router.query.preacher]);

    // Date range filters — ?dateFrom=YYYY-MM-DD&dateTo=YYYY-MM-DD
    const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
    const dateFrom = useMemo(() => {
        const v = router.query.dateFrom;
        return typeof v === 'string' && ISO_DATE_RE.test(v) ? v : '';
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [router.query.dateFrom]);
    const dateTo = useMemo(() => {
        const v = router.query.dateTo;
        return typeof v === 'string' && ISO_DATE_RE.test(v) ? v : '';
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [router.query.dateTo]);

    // Local input state for the date pickers (committed to URL on blur/change)
    const [dateFromInput, setDateFromInput] = useState('');
    const [dateToInput, setDateToInput] = useState('');
    useEffect(() => { setDateFromInput(dateFrom); }, [dateFrom]);
    useEffect(() => { setDateToInput(dateTo); }, [dateTo]);

    const applyDateFilter = (from: string, to: string) => {
        const q: Record<string, string | string[]> = { ...router.query as Record<string, string | string[]> };
        delete q.page;
        if (from) q.dateFrom = from; else delete q.dateFrom;
        if (to) q.dateTo = to; else delete q.dateTo;
        router.push({ pathname: router.pathname, query: q }, undefined, { scroll: false });
    };

    const clearDateFilter = () => {
        setDateFromInput('');
        setDateToInput('');
        applyDateFilter('', '');
    };

    // --- Results state ---
    const [videoResults, setVideoResults] = useState<any[]>([]);
    const [videoTotal, setVideoTotal] = useState(0);
    const [subtitleResults, setSubtitleResults] = useState<any[]>([]);
    const [subtitleTotal, setSubtitleTotal] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    // Discovered categories: built from unfiltered results so chips stay visible while filtering
    const [discoveredCategories, setDiscoveredCategories] = useState<{ slug: string; name: string; total: number }[]>([]);
    const [showAllChips, setShowAllChips] = useState(false);
    const CHIPS_VISIBLE = 5;

    const activeResults = urlMode === 'subtitles' ? subtitleResults : videoResults;
    const activeTotal   = urlMode === 'subtitles' ? subtitleTotal   : videoTotal;
    const pageSize = urlMode === 'subtitles' ? PAGE_SIZE_SUBTITLES : PAGE_SIZE_VIDEOS;
    const totalPages = activeTotal > 0 ? Math.ceil(activeTotal / pageSize) : 0;
    const hasResults = urlMode === 'all'
        ? videoResults.length > 0 || subtitleResults.length > 0
        : activeResults.length > 0;

    // ---- Effect 1: category discovery (always unfiltered, never reruns on filter changes) ----
    useEffect(() => {
        if (!router.isReady || !query || (urlMode !== 'subtitles' && urlMode !== 'all')) return;
        setDiscoveredCategories([]);
        setShowAllChips(false);
        let cancelled = false;
        (api.search({ query, mode: 'subtitles', limit: PAGE_SIZE_SUBTITLES, offset: 0 }) as Promise<any>)
            .then(data => { if (!cancelled) updateDiscovered(data.results || []); })
            .catch(() => {});
        return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [query, urlMode, router.isReady]);

    // ---- Effect 2: fetch results (re-runs on filter/page changes too) ----
    useEffect(() => {
        if (!router.isReady || !query) return;

        const run = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const slugParam = preacherFilters.length ? preacherFilters.join(',') : undefined;
                const dateParams = { ...(dateFrom ? { dateFrom } : {}), ...(dateTo ? { dateTo } : {}) };
                if (urlMode === 'all') {
                    const [vdResult, sdResult] = await Promise.allSettled([
                        api.search({ query, mode: 'videos', limit: ALL_MODE_VIDEO_LIMIT, offset: 0, ...dateParams }) as Promise<any>,
                        api.search({ query, mode: 'subtitles', limit: ALL_MODE_SUBTITLE_LIMIT, offset: 0, ...(slugParam ? { categorySlug: slugParam } : {}), ...dateParams }) as Promise<any>,
                    ]);
                    if (vdResult.status === 'fulfilled') {
                        setVideoResults(vdResult.value.results || []);
                        setVideoTotal(vdResult.value.total || 0);
                    }
                    if (sdResult.status === 'fulfilled') {
                        const rows: any[] = sdResult.value.results || [];
                        setSubtitleResults(rows);
                        setSubtitleTotal(sdResult.value.total || 0);
                    }
                } else if (urlMode === 'subtitles') {
                    const data = await api.search({
                        query,
                        mode: 'subtitles',
                        limit: PAGE_SIZE_SUBTITLES,
                        offset: currentPage * PAGE_SIZE_SUBTITLES,
                        ...(slugParam ? { categorySlug: slugParam } : {}),
                        ...dateParams,
                    }) as any;
                    const rows: any[] = data.results || [];
                    setSubtitleResults(rows);
                    setSubtitleTotal(data.total || 0);
                } else {
                    const data = await api.search({
                        query,
                        mode: 'videos',
                        limit: PAGE_SIZE_VIDEOS,
                        offset: currentPage * PAGE_SIZE_VIDEOS,
                        ...dateParams,
                    }) as any;
                    setVideoResults(data.results || []);
                    setVideoTotal(data.total || 0);
                }
            } catch (err: any) {
                setError(err.message || 'Search failed');
            } finally {
                setIsLoading(false);
            }
        };

        run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [query, urlMode, currentPage, preacherFilters.join(','), dateFrom, dateTo, router.isReady]);

    const goToPage = (newPage: number) => {
        const q: Record<string, string | string[]> = { ...router.query as Record<string, string | string[]> };
        if (newPage === 0) {
            delete q.page;
        } else {
            q.page = String(newPage);
        }
        router.push({ pathname: router.pathname, query: q }, undefined, { scroll: true });
    };

    // Update discovered categories from an unfiltered result set.
    // Called only from the category-discovery effect (effect 1) — never from the filtered-results effect.
    const updateDiscovered = (rows: any[]) => {
        const totals = new Map<string, { name: string; total: number }>();
        rows.forEach((r: any) => {
            if (!r.categorySlug || !r.categoryName) return;
            const prev = totals.get(r.categorySlug);
            const count = Number(r.matchCount || 1);
            totals.set(r.categorySlug, { name: r.categoryName, total: (prev?.total ?? 0) + count });
        });
        setDiscoveredCategories(
            Array.from(totals.entries())
                .map(([slug, { name, total }]) => ({ slug, name, total }))
                .sort((a, b) => b.total - a.total)
        );
    };

    const togglePreacher = (slug: string) => {
        const q: Record<string, string | string[]> = { ...router.query as Record<string, string | string[]> };
        delete q.page;
        const next = preacherFilters.includes(slug)
            ? preacherFilters.filter(s => s !== slug)
            : [...preacherFilters, slug];
        if (next.length === 0) {
            delete q.preacher;
        } else {
            q.preacher = next.join(',');
        }
        router.push({ pathname: router.pathname, query: q }, undefined, { scroll: false });
    };

    const clearAllPreachers = () => {
        const q: Record<string, string | string[]> = { ...router.query as Record<string, string | string[]> };
        delete q.page;
        delete q.preacher;
        router.push({ pathname: router.pathname, query: q }, undefined, { scroll: false });
    };

    // --- Shared video grid renderer ---
    const VideoGrid = ({ videos }: { videos: any[] }) => (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-6">
            {videos.map((video: any) => (
                <div key={video.id}>
                    <div className="md:hidden">
                        <CompactVideoCard
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
                    <div className="hidden md:block">
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
                </div>
            ))}
        </div>
    );

    const SubtitleGrid = ({ items }: { items: any[] }) => (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {items.map((item: any, idx: number) => (
                <SubtitlesResultCard
                    key={`${item.subtitlePath || item.title}-${idx}`}
                    author={item.author}
                    title={item.title}
                    videoDate={item.videoDate}
                    subtitlePath={item.subtitlePath}
                    videoId={item.videoId || item.video_id}
                    categoryName={item.categoryName || item.category_name}
                    matchCount={item.matchCount}
                    subtitles={item.subtitles || []}
                />
            ))}
        </div>
    );

    return (
        <>
            <Head>
                <title>{`Search: ${query || 'Results'} - ALLthePREACHING`}</title>
            </Head>

            <div className="container mx-auto px-4 py-8">
                {/* Preacher / category filter chips */}
                {(urlMode === 'subtitles' || urlMode === 'all') && discoveredCategories.length > 0 && (
                    <div className="mb-6">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs text-scheme-e-text/50 font-medium shrink-0 uppercase tracking-wide">Preacher:</span>

                            {/* Active (selected) chips always shown first */}
                            {preacherFilters.map(slug => {
                                const cat = discoveredCategories.find(c => c.slug === slug);
                                return (
                                    <button
                                        key={slug}
                                        type="button"
                                        onClick={() => togglePreacher(slug)}
                                        className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full
                                                   bg-primary/20 border border-primary text-primary
                                                   hover:bg-primary/30 transition-colors"
                                    >
                                        {cat?.name || slug}
                                        <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                );
                            })}

                            {/* Unselected chips — top CHIPS_VISIBLE, then hidden */}
                            {discoveredCategories
                                .filter(c => !preacherFilters.includes(c.slug))
                                .slice(0, showAllChips ? undefined : CHIPS_VISIBLE)
                                .map(({ slug, name, total }) => (
                                    <button
                                        key={slug}
                                        type="button"
                                        onClick={() => togglePreacher(slug)}
                                        className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full border
                                                   border-secondary-dark/60 text-scheme-e-text/80
                                                   hover:border-primary hover:text-primary
                                                   transition-colors"
                                    >
                                        {name}
                                        <span className="opacity-60 font-normal">{total}</span>
                                    </button>
                                ))
                            }

                            {/* Show more / less toggle */}
                            {discoveredCategories.filter(c => !preacherFilters.includes(c.slug)).length > CHIPS_VISIBLE && (
                                <button
                                    type="button"
                                    onClick={() => setShowAllChips(v => !v)}
                                    className="text-xs text-primary/70 hover:text-primary underline underline-offset-2 transition-colors"
                                >
                                    {showAllChips
                                        ? 'Show less'
                                        : `+${discoveredCategories.filter(c => !preacherFilters.includes(c.slug)).length - CHIPS_VISIBLE} more`
                                    }
                                </button>
                            )}

                            {/* Clear all */}
                            {preacherFilters.length > 0 && (
                                <button
                                    type="button"
                                    onClick={clearAllPreachers}
                                    className="text-xs text-secondary-light/50 hover:text-scheme-e-text transition-colors ml-1"
                                >
                                    Clear all
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* Date range filter */}
                {query && (
                    <div className="mb-6">
                        <div className="flex flex-wrap items-center gap-3">
                            <span className="text-xs text-scheme-e-text/50 font-medium shrink-0 uppercase tracking-wide">Date range:</span>
                            <div className="flex items-center gap-2">
                                <label className="sr-only" htmlFor="date-from">From</label>
                                <input
                                    id="date-from"
                                    type="date"
                                    value={dateFromInput}
                                    onChange={e => setDateFromInput(e.target.value)}
                                    onBlur={e => applyDateFilter(e.target.value, dateToInput)}
                                    onKeyDown={e => { if (e.key === 'Enter') { (e.target as HTMLInputElement).blur(); applyDateFilter((e.target as HTMLInputElement).value, dateToInput); } }}
                                    max={dateToInput || undefined}
                                    className="text-xs rounded-lg border border-secondary-dark/60 bg-scheme-b-bg/60 px-2 py-1
                                               text-scheme-e-text focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/40"
                                />
                                <span className="text-xs text-scheme-e-text/50">to</span>
                                <label className="sr-only" htmlFor="date-to">To</label>
                                <input
                                    id="date-to"
                                    type="date"
                                    value={dateToInput}
                                    onChange={e => setDateToInput(e.target.value)}
                                    onBlur={e => applyDateFilter(dateFromInput, e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') { (e.target as HTMLInputElement).blur(); applyDateFilter(dateFromInput, (e.target as HTMLInputElement).value); } }}
                                    min={dateFromInput || undefined}
                                    className="text-xs rounded-lg border border-secondary-dark/60 bg-scheme-b-bg/60 px-2 py-1
                                               text-scheme-e-text focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/40"
                                />
                            </div>
                            {(dateFrom || dateTo) && (
                                <button
                                    type="button"
                                    onClick={clearDateFilter}
                                    className="text-xs text-secondary-light/50 hover:text-scheme-e-text transition-colors"
                                >
                                    Clear dates
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {isLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
                        {[...Array(8)].map((_, i) => (
                            <div key={i} className="card animate-pulse">
                                <div className="aspect-video bg-gray-300 dark:bg-gray-600 rounded-lg mb-3"></div>
                                <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded mb-2"></div>
                                <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-2/3"></div>
                            </div>
                        ))}
                    </div>
                ) : error ? (
                    <div className="text-center py-12">
                        <p className="text-red-600 dark:text-red-400">{error}</p>
                    </div>
                ) : !hasResults && query ? (
                    <div className="text-center py-12">
                        <p className="text-gray-600 dark:text-gray-400">No results found for &ldquo;{query}&rdquo;</p>
                    </div>
                ) : urlMode === 'all' ? (

                    /* ── All mode: two labelled sections ── */
                    <div className="space-y-12">
                        <section>
                            <h2 className="text-xl font-bold mb-4 text-scheme-e-heading">
                                Videos
                                {videoTotal > 0 && (
                                    <span className="ml-2 text-sm font-normal text-gray-500">({videoTotal} total)</span>
                                )}
                            </h2>
                            {videoResults.length === 0 ? (
                                <p className="text-gray-500 text-sm">No videos found.</p>
                            ) : (
                                <VideoGrid videos={videoResults} />
                            )}
                            {videoTotal > ALL_MODE_VIDEO_LIMIT && (
                                <div className="mt-4">
                                    <a
                                        href={`/search?q=${encodeURIComponent(query)}`}
                                        className="btn-secondary inline-flex items-center gap-2 text-sm"
                                    >
                                        See all {videoTotal} videos
                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>
                                    </a>
                                </div>
                            )}
                        </section>

                        <section>
                            <h2 className="text-xl font-bold mb-4 text-scheme-e-heading">
                                Captions
                                {subtitleTotal > 0 && (
                                    <span className="ml-2 text-sm font-normal text-gray-500">({subtitleTotal} total)</span>
                                )}
                            </h2>
                            {subtitleResults.length === 0 ? (
                                <p className="text-gray-500 text-sm">No caption matches found.</p>
                            ) : (
                                <SubtitleGrid items={subtitleResults} />
                            )}
                            {subtitleTotal > ALL_MODE_SUBTITLE_LIMIT && (
                                <div className="mt-4">
                                    <a
                                        href={`/search?q=${encodeURIComponent(query)}&mode=subtitles`}
                                        className="btn-secondary inline-flex items-center gap-2 text-sm"
                                    >
                                        See all {subtitleTotal} caption matches
                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>
                                    </a>
                                </div>
                            )}
                        </section>
                    </div>

                ) : hasResults ? (

                    /* ── Single mode (videos or captions) ── */
                    <>
                        <p className="mb-6 text-gray-600 dark:text-gray-400">
                            {activeTotal > 0
                                ? `Showing ${currentPage * pageSize + 1}–${Math.min((currentPage + 1) * pageSize, activeTotal)} of ${activeTotal} result${activeTotal !== 1 ? 's' : ''}`
                                : `Found ${activeResults.length} result${activeResults.length !== 1 ? 's' : ''}`
                            }
                        </p>
                        {urlMode === 'subtitles' ? (
                            <SubtitleGrid items={subtitleResults} />
                        ) : (
                            <VideoGrid videos={videoResults} />
                        )}
                        {totalPages > 1 && (
                            <div className="flex items-center justify-center gap-4 mt-10">
                                <button
                                    onClick={() => goToPage(currentPage - 1)}
                                    disabled={currentPage === 0}
                                    className="btn-secondary inline-flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-none"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg>
                                    Prev
                                </button>
                                <span className="text-scheme-e-text/80 text-sm font-medium min-w-[7rem] text-center">
                                    Page {currentPage + 1} of {totalPages}
                                </span>
                                <button
                                    onClick={() => goToPage(currentPage + 1)}
                                    disabled={currentPage >= totalPages - 1}
                                    className="btn-secondary inline-flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-none"
                                >
                                    Next
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>
                                </button>
                            </div>
                        )}
                    </>
                ) : null}
            </div>
        </>
    );
}

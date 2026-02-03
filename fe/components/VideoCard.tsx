/**
 * Video card component
 * Enhanced design matching new color scheme with animations
 */
import { useRouter } from 'next/router';
import { MouseEvent, KeyboardEvent, useEffect, useRef, useState } from 'react';
import { resolveMediaUrl } from '@/lib/media';

interface VideoCardProps {
    id: number;
    title: string;
    preacher: string;
    date: string;
    thumbnail?: string;
    views?: number;
    duration?: number;
    categoryName?: string;
    categorySlug?: string;
    onCategorySelect?: (slug: string, name?: string) => void;
}

export default function VideoCard({
    id,
    title,
    preacher,
    date,
    thumbnail,
    views,
    duration,
    categoryName,
    categorySlug,
    onCategorySelect,
}: VideoCardProps) {
    const router = useRouter();
    const [imageLoaded, setImageLoaded] = useState(false);
    const imgRef = useRef<HTMLImageElement | null>(null);
    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    };

    const formatDuration = (minutes?: number | string) => {
        if (minutes === undefined || minutes === null || minutes === '') {
            return '';
        }
        const numericMinutes = typeof minutes === 'string' ? Number(minutes) : minutes;
        if (Number.isNaN(numericMinutes)) {
            return '';
        }

        const totalMinutes = Math.max(0, Math.round(numericMinutes));
        const hours = Math.floor(totalMinutes / 60);
        const mins = totalMinutes % 60;
        return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
    };

    const thumbnailSrc = resolveMediaUrl(thumbnail);
    const fallbackSrc = '/images/placeholder.png';
    const imageSrc = thumbnailSrc || fallbackSrc;
    const categoryLabel = categoryName || categorySlug || '';

    useEffect(() => {
        setImageLoaded(false);
        const imgEl = imgRef.current;
        if (imgEl && imgEl.complete && imgEl.naturalWidth > 0) {
            setImageLoaded(true);
        }
    }, [thumbnailSrc]);

    const handleCategoryClick = (event: MouseEvent<HTMLButtonElement>) => {
        if (!categorySlug) return;
        event.preventDefault();
        event.stopPropagation();

        if (onCategorySelect) {
            onCategorySelect(categorySlug, categoryName || categorySlug);
        } else {
            const query = new URLSearchParams({ category: categorySlug }).toString();
            router.push(`/videos?${query}`);
        }
    };

    const handleCardClick = () => {
        router.push(`/video/${id}`);
    };

    const handleCardKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            handleCardClick();
        }
    };

    return (
        <article className="card card-gradient group h-full flex flex-col py-4">
            <div
                role="link"
                tabIndex={0}
                aria-label={title}
                onClick={handleCardClick}
                onKeyDown={handleCardKeyDown}
                className="flex flex-col flex-grow cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary/60 rounded-lg"
            >
                {/* Thumbnail with fixed aspect ratio */}
                <div
                    className={`relative aspect-video-stable rounded-lg overflow-hidden mb-3 bg-gray-200 dark:bg-gray-700 ${!imageLoaded ? 'animate-pulse' : ''
                        }`}
                >
                    <img
                        ref={imgRef}
                        src={imageSrc}
                        alt={title}
                        loading="lazy"
                        decoding="async"
                        onLoad={() => setImageLoaded(true)}
                        onError={(event) => {
                            event.currentTarget.src = fallbackSrc;
                            setImageLoaded(true);
                        }}
                        className={`absolute inset-0 h-full w-full object-cover rounded-lg transform-gpu group-hover:scale-110 transition-transform duration-500 transition-opacity ${imageLoaded ? 'opacity-100' : 'opacity-0'
                            }`}
                        style={{ backfaceVisibility: 'hidden' }}
                    />

                    {/* Duration badge */}
                    {duration !== undefined && duration !== null && formatDuration(duration) && (
                        <div className="absolute bottom-2 right-2 
                                      bg-scheme-e-bg/90 backdrop-blur-sm 
                                      text-primary text-xs font-semibold 
                                      px-2 py-1 rounded border border-primary/30">
                            {formatDuration(duration)}
                        </div>
                    )}
                    {views !== undefined && (
                        <div className="absolute bottom-2 left-2 
                                      bg-scheme-e-bg/90 backdrop-blur-sm 
                                      text-primary text-[11px] font-semibold 
                                      px-2 py-1 rounded border border-primary/30 flex items-center gap-1">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                                <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                            </svg>
                            {views.toLocaleString()}
                        </div>
                    )}

                    {/* Play overlay on hover */}
                    <div className="absolute inset-0 rounded-lg video-card-overlay backdrop-blur-sm 
                                  flex items-center justify-center 
                                  opacity-0 group-hover:opacity-100 
                                  transition-opacity duration-300">
                        <div className="w-16 h-16 rounded-full bg-primary/90 
                                      flex items-center justify-center 
                                      transform group-hover:scale-110 transition-transform duration-300">
                            <svg className="w-8 h-8 text-scheme-c-bg ml-1" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                            </svg>
                        </div>
                    </div>
                </div>

                <h3 className="font-semibold text-sm mb-2 text-scheme-c-text/90 group-hover:text-primary transition-colors duration-300">
                    <span className="video-title-marquee">
                        <span className="video-title-marquee__text">{title}</span>
                    </span>
                </h3>
            </div>

            {(categorySlug || date) && (
                <div className="mt-0.5 mb-4 flex items-center justify-between gap-2 text-xs text-secondary-light/80">
                    {categorySlug ? (
                        <button
                            type="button"
                            onClick={handleCategoryClick}
                            className="text-xs font-semibold px-3 py-1 rounded-full border border-primary/40 text-primary hover:bg-primary/10 transition-colors"
                        >
                            {categoryLabel}
                        </button>
                    ) : (
                        <span />
                    )}
                    <span>{formatDate(date)}</span>
                </div>
            )}
        </article>
    );
}

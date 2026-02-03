import Link from 'next/link';
import { useRouter } from 'next/router';
import { MouseEvent } from 'react';
import { resolveMediaUrl } from '@/lib/media';

interface CompactVideoCardProps {
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

const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });

const formatDuration = (minutes?: number | string) => {
    if (minutes === undefined || minutes === null || minutes === '') return '';
    const numericMinutes = typeof minutes === 'string' ? Number(minutes) : minutes;
    if (Number.isNaN(numericMinutes)) return '';
    const totalMinutes = Math.max(0, Math.round(numericMinutes));
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
};

export default function CompactVideoCard({
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
}: CompactVideoCardProps) {
    const router = useRouter();
    const thumbnailSrc = resolveMediaUrl(thumbnail) || '/images/placeholder.png';
    const durationLabel = formatDuration(duration);
    const categoryLabel = categoryName || categorySlug || '';

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

    return (
        <Link
            href={`/video/${id}`}
            className="flex gap-3 rounded-xl border border-secondary-dark/40 bg-scheme-b-bg/40 hover:bg-scheme-b-bg/70 transition-colors p-3"
        >
            <div className="relative flex-shrink-0 w-32 aspect-video rounded-lg overflow-hidden bg-scheme-c-bg/40">
                <img
                    src={thumbnailSrc}
                    alt={title}
                    loading="lazy"
                    decoding="async"
                    className="absolute inset-0 h-full w-full object-cover"
                />
                {durationLabel && (
                    <span className="absolute bottom-1 right-1 text-[11px] px-1.5 py-0.5 rounded bg-scheme-e-bg/90 text-primary font-semibold">
                        {durationLabel}
                    </span>
                )}
            </div>

            <div className="flex flex-col text-sm gap-1 text-scheme-c-text/90">
                <p className="font-semibold leading-snug line-clamp-2">{title}</p>
                {preacher && <span className="text-xs text-primary/80">{preacher}</span>}
                {categorySlug && (
                    <button
                        type="button"
                        onClick={handleCategoryClick}
                        className="mt-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full border border-primary/40 text-primary hover:bg-primary/10 transition-colors self-start"
                    >
                        {categoryLabel}
                    </button>
                )}
                <span className="text-[11px] text-secondary-light/70">{formatDate(date)}</span>
                {views !== undefined && (
                    <span className="text-[11px] text-secondary-light/70">{views.toLocaleString()} views</span>
                )}
            </div>
        </Link>
    );
}

/**
 * Video card component
 * Enhanced design matching new color scheme with animations
 */
import Link from 'next/link';
import Image from 'next/image';
import { resolveMediaUrl } from '@/lib/media';

interface VideoCardProps {
    id: number;
    title: string;
    preacher: string;
    date: string;
    thumbnail?: string;
    views?: number;
    duration?: number;
}

export default function VideoCard({
    id,
    title,
    preacher,
    date,
    thumbnail,
    views,
    duration,
}: VideoCardProps) {
    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    };

    const formatDuration = (minutes?: number) => {
        if (minutes === undefined || minutes === null) {
            return '';
        }

        const totalMinutes = Math.max(0, Math.round(minutes));
        const hours = Math.floor(totalMinutes / 60);
        const mins = totalMinutes % 60;
        return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
    };

    const thumbnailSrc = resolveMediaUrl(thumbnail);

    return (
        <Link href={`/video/${id}`}>
            <div className="card card-gradient group cursor-pointer h-full flex flex-col">
                {/* Thumbnail with fixed aspect ratio */}
                <div className="relative aspect-video-stable rounded-lg overflow-hidden mb-3 bg-gray-200 dark:bg-gray-700">
                    {thumbnailSrc ? (
                        <Image
                            src={thumbnailSrc}
                            alt={title}
                            fill
                            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                            className="object-cover group-hover:scale-110 transition-transform duration-500"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-primary/40">
                            <svg className="w-16 h-16" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" />
                            </svg>
                        </div>
                    )}

                    {/* Duration badge */}
                    {typeof duration === 'number' && (
                        <div className="absolute bottom-2 right-2 
                                      bg-scheme-e-bg/90 backdrop-blur-sm 
                                      text-primary text-xs font-semibold 
                                      px-2 py-1 rounded border border-primary/30">
                            {formatDuration(duration)}
                        </div>
                    )}

                    {/* Play overlay on hover */}
                    <div className="absolute inset-0 bg-scheme-e-bg/60 backdrop-blur-sm 
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

                {/* Metadata - flex-grow to fill remaining space */}
                <div className="flex-grow flex flex-col">
                    <h3 className="font-semibold text-sm mb-2 line-clamp-2 
                                 text-scheme-c-text/90
                                 group-hover:text-primary transition-colors duration-300">
                        {title}
                    </h3>

                    <p className="text-sm text-primary/80 mb-2 font-medium">
                        {preacher}
                    </p>

                    {/* Push metadata to bottom */}
                    <div className="mt-auto flex items-center justify-between text-xs text-secondary-light/80">
                        <span>{formatDate(date)}</span>
                        {views !== undefined && (
                            <span className="flex items-center gap-1">
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                                    <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                                </svg>
                                {views.toLocaleString()}
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </Link>
    );
}

/**
 * Video card component
 * Display video thumbnail, title, preacher, and metadata
 */
import Link from 'next/link';
import Image from 'next/image';

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
        if (!minutes) return '';
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
    };

    return (
        <Link href={`/video/${id}`}>
            <div className="card group cursor-pointer">
                {/* Thumbnail */}
                <div className="relative aspect-video bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden mb-3">
                    {thumbnail ? (
                        <Image
                            src={thumbnail}
                            alt={title}
                            fill
                            className="object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400">
                            <svg className="w-16 h-16" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" />
                            </svg>
                        </div>
                    )}

                    {duration && (
                        <div className="absolute bottom-2 right-2 bg-black bg-opacity-80 text-white text-xs px-2 py-1 rounded">
                            {formatDuration(duration)}
                        </div>
                    )}
                </div>

                {/* Metadata */}
                <div>
                    <h3 className="font-semibold text-sm mb-1 line-clamp-2 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                        {title}
                    </h3>

                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                        {preacher}
                    </p>

                    <div className="flex items-center text-xs text-gray-500 dark:text-gray-500 gap-3">
                        <span>{formatDate(date)}</span>
                        {views !== undefined && <span>{views.toLocaleString()} views</span>}
                    </div>
                </div>
            </div>
        </Link>
    );
}

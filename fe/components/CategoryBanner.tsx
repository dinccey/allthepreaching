/**
 * CategoryBanner Component
 * Displays category sections with gradient backgrounds
 * Inspired by the old site's about section banners
 */
import Link from 'next/link';

interface CategoryBannerProps {
    title: string;
    subtitle: string;
    description: string;
    link: string;
    colorScheme: 'success' | 'warning' | 'info';
    className?: string;
}

const colorSchemes = {
    success: {
        bg: 'from-green-800 to-green-900',
        overlay: 'bg-gradient-to-br from-green-600/30 to-green-900/50',
        badge: 'bg-green-500/80',
        text: 'text-green-100',
    },
    warning: {
        bg: 'from-yellow-800 to-yellow-900',
        overlay: 'bg-gradient-to-br from-yellow-600/30 to-yellow-900/50',
        badge: 'bg-yellow-500/80',
        text: 'text-yellow-100',
    },
    info: {
        bg: 'from-blue-800 to-blue-900',
        overlay: 'bg-gradient-to-br from-blue-600/30 to-blue-900/50',
        badge: 'bg-blue-500/80',
        text: 'text-blue-100',
    },
};

export default function CategoryBanner({
    title,
    subtitle,
    description,
    link,
    colorScheme,
    className = '',
}: CategoryBannerProps) {
    const colors = colorSchemes[colorScheme];

    return (
        <Link href={link} className={`block ${className}`}>
            <div className="category-banner h-full min-h-[280px]">
                {/* Background gradient */}
                <div className={`absolute inset-0 bg-gradient-to-br ${colors.bg}`} />

                {/* Hover overlay */}
                <div className={`absolute inset-0 ${colors.overlay} opacity-0 transition-opacity duration-300 group-hover:opacity-100`} />

                {/* Content */}
                <div className="relative z-10 h-full flex flex-col justify-between">
                    {/* Top section */}
                    <div className="space-y-2">
                        <h3 className="text-2xl md:text-3xl font-light text-white">
                            {title}
                        </h3>
                        <p className="text-lg md:text-xl text-white/90 font-semibold">
                            {subtitle}
                        </p>
                    </div>

                    {/* Bottom badge section */}
                    <div className={`${colors.badge} backdrop-blur-md px-6 py-4 rounded-lg inline-block self-start`}>
                        <p className={`${colors.text} text-base md:text-lg font-semibold leading-relaxed`}>
                            {description}
                        </p>
                    </div>
                </div>
            </div>
        </Link>
    );
}

/**
 * CategoryBannerGrid Component
 * Grid layout for category banners - matches old site structure
 */
interface CategoryBannerGridProps {
    children: React.ReactNode;
    className?: string;
}

export function CategoryBannerGrid({ children, className = '' }: CategoryBannerGridProps) {
    return (
        <div className={`grid grid-cols-1 md:grid-cols-3 gap-6 ${className}`}>
            {children}
        </div>
    );
}

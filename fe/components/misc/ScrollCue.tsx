import Link from 'next/link';

export default function ScrollCue() {
    return (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10">
            <Link
                href="#videos"
                className="flex flex-col items-center gap-2 text-scheme-e-text/90 hover:text-primary transition-colors duration-300"
                aria-label="Scroll to latest videos"
            >
                <span className="text-xs uppercase tracking-widest">More below</span>
                <span className="w-8 h-8 rounded-full border border-primary/40 flex items-center justify-center animate-bounce">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </span>
            </Link>
        </div>
    );
}

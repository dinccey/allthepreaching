/**
 * ThemeToggle component
 * Switch between light and dark themes with smooth transitions
 * Best practices: accessible, follows system preferences by default, persists user choice
 */
import { useTheme } from '@/contexts/ThemeContext';
import { useEffect, useState } from 'react';

export default function ThemeToggle() {
    const { theme, toggleTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    // Prevent hydration mismatch by only rendering after mount
    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        // Render placeholder to prevent layout shift
        return (
            <div className="w-[60px] h-[28px] bg-secondary-dark/30 rounded-full" />
        );
    }

    return (
        <button
            onClick={toggleTheme}
            className="relative inline-flex items-center h-[28px] w-[60px] rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-transparent bg-secondary-dark/30 hover:bg-secondary-dark/50"
            role="switch"
            aria-checked={theme === 'dark'}
            aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
        >
            {/* Toggle background */}
            <span
                className={`${
                    theme === 'dark' ? 'translate-x-[34px] bg-primary' : 'translate-x-[2px] bg-primary-600'
                } inline-block h-[24px] w-[24px] transform rounded-full transition-all duration-300 shadow-md`}
            >
                {/* Icon container */}
                <span className="flex items-center justify-center h-full w-full">
                    {theme === 'light' ? (
                        // Sun icon
                        <svg
                            className="h-4 w-4 text-white"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                        >
                            <path
                                fillRule="evenodd"
                                d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z"
                                clipRule="evenodd"
                            />
                        </svg>
                    ) : (
                        // Moon icon
                        <svg
                            className="h-4 w-4 text-scheme-e-bg"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                        >
                            <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                        </svg>
                    )}
                </span>
            </span>

            {/* Label text */}
            <span className="sr-only">
                {theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
            </span>
        </button>
    );
}

/**
 * Theme context and provider
 * Manages light/dark mode based on system preference or user selection
 */
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
    theme: Theme;
    toggleTheme: () => void;
    setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = 'theme';
const THEME_COOKIE_KEY = 'theme';

const isValidTheme = (value: string | null): value is Theme => value === 'light' || value === 'dark';

const getCookieTheme = (): Theme | null => {
    if (typeof document === 'undefined') return null;
    const match = document.cookie.match(/(?:^|; )theme=(light|dark)/);
    return match ? (match[1] as Theme) : null;
};

const persistTheme = (theme: Theme) => {
    if (typeof document === 'undefined') return;
    localStorage.setItem(THEME_STORAGE_KEY, theme);
    document.cookie = `${THEME_COOKIE_KEY}=${theme}; path=/; max-age=31536000; samesite=lax`;
};

const applyThemeToDocument = (theme: Theme) => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
    root.style.colorScheme = theme;
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
        metaTheme.setAttribute('content', theme === 'dark' ? '#141414' : '#faf7f4');
    }
};

export function ThemeProvider({ children }: { children: ReactNode }) {
    const [theme, setThemeState] = useState<Theme>('light');
    const [useSystemPreference, setUseSystemPreference] = useState(true);

    useEffect(() => {
        const stored = typeof window !== 'undefined' ? localStorage.getItem(THEME_STORAGE_KEY) : null;
        const storedTheme = isValidTheme(stored) ? stored : getCookieTheme();

        if (storedTheme) {
            setUseSystemPreference(false);
            setThemeState(storedTheme);
        } else {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            setThemeState(prefersDark ? 'dark' : 'light');
        }
    }, []);

    useEffect(() => {
        applyThemeToDocument(theme);
    }, [theme]);

    useEffect(() => {
        if (!useSystemPreference) return;

        const media = window.matchMedia('(prefers-color-scheme: dark)');
        const handleChange = (event: MediaQueryListEvent) => {
            setThemeState(event.matches ? 'dark' : 'light');
        };

        if (media.addEventListener) {
            media.addEventListener('change', handleChange);
        } else {
            media.addListener(handleChange);
        }

        return () => {
            if (media.removeEventListener) {
                media.removeEventListener('change', handleChange);
            } else {
                media.removeListener(handleChange);
            }
        };
    }, [useSystemPreference]);

    const setTheme = (newTheme: Theme) => {
        setUseSystemPreference(false);
        setThemeState(newTheme);
        persistTheme(newTheme);
    };

    const toggleTheme = () => {
        setTheme(theme === 'light' ? 'dark' : 'light');
    };

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within ThemeProvider');
    }
    return context;
}

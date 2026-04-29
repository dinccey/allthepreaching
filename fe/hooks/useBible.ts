import useSWR from 'swr';
import { fetcher } from '@/lib/api';

export interface BibleLanguage {
    id: string;
    label: string;
    translationLabel: string;
    hasText: boolean;
    hasAudio: boolean;
    isDefault?: boolean;
}

export interface BibleBookMeta {
    bookId: string;
    name: string;
    bookIndex: number;
    chapterCount: number;
    hasAudio: boolean;
    testament: 'old' | 'new';
}

export interface BibleIndex {
    language: string;
    label: string;
    translationLabel: string;
    generatedAt: string;
    books: BibleBookMeta[];
}

export interface BibleVerse {
    verse: number;
    text: string;
    hasAudio: boolean;
    audioPath: string | null;
}

export interface BibleChapter {
    language: string;
    translationLabel: string;
    book: {
        id: string;
        name: string;
        bookIndex: number;
    };
    chapter: number;
    chapterCount: number;
    hasAudio: boolean;
    audio: {
        bookIntro: {
            available: boolean;
            path: string | null;
        };
        chapterIntro: {
            available: boolean;
            path: string | null;
        };
    };
    verses: BibleVerse[];
    navigation: {
        previousChapter: { bookId: string; chapter: number } | null;
        nextChapter: { bookId: string; chapter: number } | null;
    };
    prefetchHints: {
        previousChapterKey: string | null;
        nextChapterKey: string | null;
    };
}

export function useBibleLanguages() {
    const { data, error, isLoading } = useSWR<BibleLanguage[]>('/api/bible/languages', fetcher);

    return {
        languages: data || [],
        isLoading,
        isError: error,
    };
}

export function useBibleMeta(language: string | undefined) {
    const { data, error, isLoading } = useSWR<BibleIndex>(
        language ? `/api/bible/${language}/meta` : null,
        fetcher
    );

    return {
        meta: data,
        isLoading,
        isError: error,
    };
}

export function useBibleChapter(language: string | undefined, bookId: string | undefined, chapter: string | undefined) {
    const { data, error, isLoading, mutate } = useSWR<BibleChapter>(
        language && bookId && chapter ? `/api/bible/${language}/books/${bookId}/chapters/${chapter}` : null,
        fetcher
    );

    return {
        chapterData: data,
        isLoading,
        isError: error,
        mutate,
    };
}
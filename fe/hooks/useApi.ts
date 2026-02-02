/**
 * Custom hook for API calls with SWR
 * Provides loading states, error handling, and automatic revalidation
 */
import useSWR from 'swr';
import { fetcher } from '@/lib/api';

interface VideosResponse {
    videos: any[];
    pagination: any;
}

interface Preacher {
    name: string;
    videoCount: number;
    latestVideo?: string;
    totalViews?: number;
}

export function useVideos(params?: Record<string, string>) {
    const queryString = params ? '?' + new URLSearchParams(params).toString() : '';
    const { data, error, isLoading, mutate } = useSWR<VideosResponse>(
        `/api/videos${queryString}`,
        fetcher
    );

    return {
        videos: data?.videos || [],
        pagination: data?.pagination,
        isLoading,
        isError: error,
        mutate,
    };
}

export function useVideo(id: string | undefined) {
    const { data, error, isLoading, mutate } = useSWR<any>(
        id ? `/api/videos/${id}` : null,
        fetcher
    );

    return {
        video: data,
        isLoading,
        isError: error,
        mutate,
    };
}

export function useRecommendations(id: string | undefined, limit = 10) {
    const { data, error, isLoading } = useSWR<any[]>(
        id ? `/api/videos/${id}/recommendations?limit=${limit}` : null,
        fetcher
    );

    return {
        recommendations: data || [],
        isLoading,
        isError: error,
    };
}

export function usePreachers() {
    const { data, error, isLoading } = useSWR<Preacher[]>(
        '/api/preachers',
        fetcher
    );

    return {
        preachers: data || [],
        isLoading,
        isError: error,
    };
}

export function usePreacher(slug: string | undefined) {
    const { data, error, isLoading } = useSWR<Preacher>(
        slug ? `/api/preachers/${slug}` : null,
        fetcher
    );

    return {
        preacher: data,
        isLoading,
        isError: error,
    };
}

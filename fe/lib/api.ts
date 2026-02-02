/**
 * API client utilities
 * Centralized fetch wrapper for backend communication
 */
import config from '@/config';

const API_URL = config.api.baseUrl;

interface FetchOptions extends RequestInit {
    params?: Record<string, string>;
}

export async function fetcher<T>(
    endpoint: string,
    options: FetchOptions = {}
): Promise<T> {
    const { params, ...fetchOptions } = options;

    let url = `${API_URL}${endpoint}`;

    if (params) {
        const queryString = new URLSearchParams(params).toString();
        url += `?${queryString}`;
    }

    const response = await fetch(url, {
        ...fetchOptions,
        headers: {
            'Content-Type': 'application/json',
            ...fetchOptions.headers,
        },
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Network error' }));
        throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
}

export const api = {
    videos: {
        list: (params?: Record<string, string>) =>
            fetcher('/api/videos', { params }),

        get: (id: string) =>
            fetcher(`/api/videos/${id}`),

        recommendations: (id: string, limit = 10) =>
            fetcher(`/api/videos/${id}/recommendations`, {
                params: { limit: limit.toString() }
            }),
    },

    preachers: {
        list: () =>
            fetcher('/api/preachers'),

        get: (slug: string) =>
            fetcher(`/api/preachers/${slug}`),
    },

    search: (query: string, limit = 20, offset = 0) =>
        fetcher('/api/search', {
            params: { q: query, limit: limit.toString(), offset: offset.toString() }
        }),
};

export default api;

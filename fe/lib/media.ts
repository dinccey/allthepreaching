/**
 * Media helper utilities
 * Ensures frontend always requests assets through the configured API host
 */
import config from '@/config';

const ABSOLUTE_URL_REGEX = /^https?:\/\//i;

export function resolveMediaUrl(path?: string | null) {
    if (!path) {
        return undefined;
    }

    if (ABSOLUTE_URL_REGEX.test(path)) {
        return path;
    }

    const normalized = path.startsWith('/') ? path : `/${path}`;
    return `${config.api.baseUrl}${normalized}`;
}

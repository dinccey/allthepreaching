/**
 * Abstract video provider interface
 * Supports multiple backends (Caddy, MinIO/S3)
 */

class VideoProvider {
    /**
     * Get the full URL for a video file
     * @param {string} path - Relative path or identifier
     * @returns {string} Full URL to video
     */
    getUrl(path) {
        throw new Error('getUrl must be implemented by subclass');
    }

    /**
     * Get thumbnail URL for a video
     * @param {string} path - Relative path or identifier
     * @returns {string} Full URL to thumbnail
     */
    getThumbnailUrl(path) {
        throw new Error('getThumbnailUrl must be implemented by subclass');
    }
}

/**
 * Caddy static server provider
 * Fetches from kjv1611only.com or local Caddy instance
 */
const ABSOLUTE_URL_REGEX = /^https?:\/\//i;

class CaddyProvider extends VideoProvider {
    constructor(baseUrl) {
        super();
        const fallbackBase = process.env.CADDY_BASE_URL || 'https://kjv1611only.com';
        this.baseUrl = this.normalizeBaseUrl(baseUrl || fallbackBase);
    }

    normalizeBaseUrl(url) {
        if (!url) {
            return '';
        }
        return url.trim().replace(/\/+$/, '');
    }

    resolvePath(path) {
        if (!path) {
            return this.baseUrl;
        }

        if (ABSOLUTE_URL_REGEX.test(path)) {
            return path;
        }

        const cleanPath = path.replace(/^\/+/, '');
        return `${this.baseUrl}/${cleanPath}`;
    }

    getUrl(path) {
        return this.resolvePath(path);
    }

    getThumbnailUrl(path) {
        // Assume thumbnails live next to the video using .jpg extension
        const thumbnailPath = path.replace(/\.[^/.]+$/, '.jpg');
        return this.resolvePath(thumbnailPath);
    }
}

/**
 * MinIO/S3 provider for future cloud storage
 */
class MinIOProvider extends VideoProvider {
    constructor(config) {
        super();
        this.endpoint = config.endpoint || process.env.MINIO_ENDPOINT;
        this.bucket = config.bucket || process.env.MINIO_BUCKET;
        this.accessKey = config.accessKey || process.env.MINIO_ACCESS_KEY;
        this.secretKey = config.secretKey || process.env.MINIO_SECRET_KEY;
    }

    getUrl(path) {
        if (ABSOLUTE_URL_REGEX.test(path)) {
            return path;
        }

        const cleanPath = path.startsWith('/') ? path.substring(1) : path;
        return `https://${this.endpoint}/${this.bucket}/${cleanPath}`;
    }

    getThumbnailUrl(path) {
        const videoPath = path.replace(/\.[^/.]+$/, '.jpg');
        return this.getUrl(videoPath);
    }
}

/**
 * Factory function to create appropriate provider
 */
function createVideoProvider(options = {}) {
    const source = (options.source || process.env.VIDEO_SOURCE || 'caddy').toLowerCase();

    switch (source) {
        case 'minio':
        case 's3':
            return new MinIOProvider(options.minio || {});
        case 'caddy':
        default:
            return new CaddyProvider(options.caddy?.baseUrl);
    }
}

module.exports = {
    VideoProvider,
    CaddyProvider,
    MinIOProvider,
    createVideoProvider
};

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
class CaddyProvider extends VideoProvider {
    constructor(baseUrl) {
        super();
        this.baseUrl = baseUrl || process.env.CADDY_BASE_URL;
    }

    getUrl(path) {
        // Remove leading slash if present
        const cleanPath = path.startsWith('/') ? path.substring(1) : path;
        return `${this.baseUrl}/${cleanPath}`;
    }

    getThumbnailUrl(path) {
        // Assume thumbnails are stored with .jpg extension
        const videoPath = path.replace(/\.[^/.]+$/, '.jpg');
        return this.getUrl(videoPath);
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
        // Generate presigned URL or public URL
        // For now, return simple URL (implement proper S3 signing later)
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
function createVideoProvider() {
    const source = process.env.VIDEO_SOURCE || 'caddy';

    switch (source.toLowerCase()) {
        case 'minio':
        case 's3':
            return new MinIOProvider({});
        case 'caddy':
        default:
            return new CaddyProvider();
    }
}

module.exports = {
    VideoProvider,
    CaddyProvider,
    MinIOProvider,
    createVideoProvider
};

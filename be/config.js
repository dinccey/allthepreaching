/**
 * Backend Configuration
 * Centralized configuration management
 * All configs loaded from environment variables with validation
 */

const config = {
    // Server Configuration
    server: {
        port: parseInt(process.env.PORT || '3001', 10),
        env: process.env.NODE_ENV || 'development',
        isDevelopment: process.env.NODE_ENV !== 'production',
        isProduction: process.env.NODE_ENV === 'production',
    },

    // Database Configuration
    database: {
        useMock: process.env.USE_MOCK_DB === 'true',
        host: process.env.DB_HOST || '',
        port: parseInt(process.env.DB_PORT || '3306', 10),
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASS || '',
        database: process.env.DB_NAME || 'allthepreaching',
        connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '10', 10),
    },

    // CORS Configuration
    cors: {
        origin: (() => {
            const raw = process.env.CORS_ORIGIN || 'http://localhost:3000';
            const parts = raw.split(',').map((value) => value.trim()).filter(Boolean);
            return parts.length > 1 ? parts : parts[0];
        })(),
        credentials: true,
    },

    // Video Provider Configuration
    video: {
        source: process.env.VIDEO_SOURCE || 'caddy', // 'caddy' or 'minio'
        caddy: {
            baseUrl: process.env.CADDY_BASE_URL || 'https://videos.allthepreaching.com',
        },
        minio: {
            endpoint: process.env.MINIO_ENDPOINT || '',
            accessKey: process.env.MINIO_ACCESS_KEY || '',
            secretKey: process.env.MINIO_SECRET_KEY || '',
            bucket: process.env.MINIO_BUCKET || 'atp-videos',
        },
    },

    // API Security
    security: {
        cloneApiKey: process.env.API_CLONE_KEY || '',
        rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW || '900000', 10), // 15 min
        rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
        disableRateLimit: process.env.DISABLE_RATE_LIMIT === 'true',
        allowLocalBypass: process.env.RATE_LIMIT_ALLOW_LOCAL_BYPASS !== 'false',
    },

    // External Services
    services: {
        searchUrl: process.env.SEARCH_SERVICE_URL || '',
    },
};

/**
 * Validate required configuration
 * Throws error if critical config is missing
 */
function validateConfig() {
    // Skip DB validation if using mock
    if (config.database.useMock) {
        console.log('⚠️  Using MOCK database - skipping DB configuration validation');
        return;
    }

    const required = [
        { key: 'DB_HOST', value: config.database.host },
        { key: 'DB_PORT', value: config.database.port },
        { key: 'DB_USER', value: config.database.user },
        { key: 'DB_NAME', value: config.database.database },
    ];

    const missing = required.filter(({ value }) => !value);

    if (missing.length > 0) {
        throw new Error(
            `Missing required configuration: ${missing.map(m => m.key).join(', ')}\n` +
            'Please check your .env file or environment variables.'
        );
    }

    // Warn about production-specific requirements
    if (config.server.isProduction) {
        if (!config.database.password) {
            console.warn('⚠ WARNING: Running in production without database password!');
        }
        if (!config.security.cloneApiKey) {
            console.warn('⚠ WARNING: Clone API key not set. Clone endpoints will be disabled.');
        }
    }
}

// Validate on load
validateConfig();

module.exports = config;

/**
 * Frontend Configuration
 * Centralized configuration management
 * Uses NEXT_PUBLIC_* env vars (available in browser)
 */

export const config = {
    // API Configuration
    api: {
        baseUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
        timeout: 30000, // 30 seconds
    },

    // Site Configuration
    site: {
        url: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
        name: 'ALLthePREACHING',
        title: 'ALLthePREACHING - KJV-only Independent Fundamental Baptist Preaching',
        description: 'Faithful KJV-only preaching from Independent Fundamental Baptist pastors',
    },

    // Feature Flags
    features: {
        pwa: true,
        wakelock: true,
        audioMode: true,
        darkMode: true,
    },

    // Pagination Defaults
    pagination: {
        defaultLimit: 20,
        maxLimit: 100,
    },

    // Video Player Settings
    player: {
        playbackRates: [0.5, 0.75, 1, 1.25, 1.5, 2],
        defaultVolume: 0.8,
        autoplay: false,
    },
};

/**
 * Validate configuration
 * Logs warnings for missing optional config
 */
export function validateConfig() {
    if (!config.api.baseUrl) {
        console.warn('⚠ API base URL not configured. Using default:', config.api.baseUrl);
    }

    // Check if URLs are properly formatted
    try {
        new URL(config.api.baseUrl);
    } catch {
        console.error('❌ Invalid API URL:', config.api.baseUrl);
    }
}

// Validate on import
if (typeof window !== 'undefined') {
    validateConfig();
}

export default config;

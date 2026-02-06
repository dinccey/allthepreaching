const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
const apiUrl = process.env.NEXT_PUBLIC_API_URL || (() => {
    try {
        const site = new URL(siteUrl);
        const host = (site.hostname || '').toLowerCase();
        if (host === 'localhost' || host === '127.0.0.1') {
            return 'http://localhost:3001';
        }

        const parts = host.split('.');
        if (parts[0] === 'www') {
            parts.shift();
        }

        return `${site.protocol}//api.${parts.join('.')}`;
    } catch (error) {
        return 'http://localhost:3001';
    }
})();
let apiHostname = 'localhost';

try {
    apiHostname = new URL(apiUrl).hostname || 'localhost';
} catch (error) {
    console.warn('Unable to parse NEXT_PUBLIC_API_URL for image domains:', error);
}

const remotePatterns = [
    { protocol: 'https', hostname: 'videos.allthepreaching.com' },
    { protocol: 'https', hostname: 'kjv1611only.com' },
];

if (apiHostname) {
    remotePatterns.push({ protocol: 'http', hostname: apiHostname });
    remotePatterns.push({ protocol: 'https', hostname: apiHostname });
}

const apiOrigin = (() => {
    try {
        return new URL(apiUrl).origin;
    } catch (error) {
        return '';
    }
})();

const isProduction = process.env.NODE_ENV === 'production';
const siteIsHttp = siteUrl.startsWith('http://') || siteUrl.includes('localhost') || siteUrl.includes('127.0.0.1');
const allowHttpForApi = !isProduction || siteIsHttp || apiOrigin.startsWith('http://') || apiOrigin.includes('localhost') || apiOrigin.includes('127.0.0.1');
const localHttpSources = allowHttpForApi ? ' http://localhost:3001 http://127.0.0.1:3001' : '';
const apiImageSource = apiOrigin ? apiOrigin : '';
const cspDirectives = [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    `img-src 'self' data: blob: https:${allowHttpForApi ? ' http:' : ''} ${apiImageSource}${localHttpSources}`,
    "font-src 'self' data: https:",
    "style-src 'self' 'unsafe-inline' https:",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https:",
    `connect-src 'self' ${apiOrigin} https: http:`,
    `media-src 'self' ${apiOrigin} https: blob:${allowHttpForApi ? ' http:' : ''}${localHttpSources}`,
    ...(isProduction && !siteIsHttp ? ['upgrade-insecure-requests'] : [])
].filter(Boolean);

const securityHeaders = [
    { key: 'Content-Security-Policy', value: cspDirectives.join('; ') },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'X-Frame-Options', value: 'DENY' }
];

if (process.env.NODE_ENV === 'production') {
    securityHeaders.push({
        key: 'Strict-Transport-Security',
        value: 'max-age=31536000; includeSubDomains; preload'
    });
}

/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    images: {
        remotePatterns,
        formats: ['image/avif', 'image/webp']
    },
    env: {
        NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
        NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL
    },
    // Enable static export for PWA
    output: 'standalone',
    async headers() {
        return [
            {
                source: '/:path*',
                headers: securityHeaders
            }
        ];
    }
};

module.exports = nextConfig;

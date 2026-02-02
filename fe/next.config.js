const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
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

/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    swcMinify: true,
    images: {
        remotePatterns,
        formats: ['image/avif', 'image/webp']
    },
    env: {
        NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
        NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL
    },
    // Enable static export for PWA
    output: 'standalone'
};

module.exports = nextConfig;

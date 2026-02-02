/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    swcMinify: true,
    images: {
        domains: ['videos.allthepreaching.com', 'caddy-server'],
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

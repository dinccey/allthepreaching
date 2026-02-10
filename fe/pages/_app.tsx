/**
 * Main App component
 * Wraps all pages with providers and global styles
 * Enhanced with stable layout to prevent shifting
 */
import type { AppProps } from 'next/app';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import { ThemeProvider } from '@/contexts/ThemeContext';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import PwaInstallPrompt from '@/components/PwaInstallPrompt';
import '@/styles/globals.css';

export default function App({ Component, pageProps }: AppProps) {
    const router = useRouter();

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const isStandalone = window.matchMedia('(display-mode: standalone)').matches
            || (window.navigator as any).standalone === true;

        if (!isStandalone) return;

        const savedPath = window.localStorage.getItem('atp_last_path');
        if (!savedPath || savedPath === router.asPath) return;

        if (savedPath.startsWith('/')) {
            router.replace(savedPath);
        }
    }, [router]);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const handleRouteChange = (url: string) => {
            window.localStorage.setItem('atp_last_path', url);
        };

        router.events.on('routeChangeComplete', handleRouteChange);
        return () => {
            router.events.off('routeChangeComplete', handleRouteChange);
        };
    }, [router.events]);

    return (
        <>
            <Head>
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <link rel="manifest" href="/manifest.json" />
                <link rel="apple-touch-icon" href="/icons/ATP_logo.png" />
                <link rel="icon" href="/icons/ATP_logo.png" type="image/png" />
                <meta name="theme-color" content="#141414" />
                <meta name="apple-mobile-web-app-capable" content="yes" />
                <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
                <meta name="apple-mobile-web-app-title" content="ALLthePREACHING" />
            </Head>

            <ThemeProvider>
                {/* Main Layout - stable height to prevent shifting */}
                <div className="flex flex-col min-h-screen-stable">
                    {/* Header with fixed height reservation */}
                    <div className="h-20 md:h-24 lg:h-32" aria-hidden="true" />
                    <Header />

                    {/* Main content area - grows to fill space */}
                    <main className="flex-grow relative">
                        <div key={router.asPath} className="animate-fade-in">
                            <Component {...pageProps} />
                        </div>
                    </main>

                    <PwaInstallPrompt />

                    {/* Footer */}
                    <Footer />
                </div>
            </ThemeProvider>
        </>
    );
}

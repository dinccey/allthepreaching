/**
 * Main App component
 * Wraps all pages with providers and global styles
 * Enhanced with stable layout to prevent shifting
 */
import type { AppProps } from 'next/app';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { ThemeProvider } from '@/contexts/ThemeContext';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import '@/styles/globals.css';

export default function App({ Component, pageProps }: AppProps) {
    const router = useRouter();

    return (
        <>
            <Head>
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <link rel="manifest" href="/manifest.json" />
                <link rel="apple-touch-icon" href="/icon-192x192.png" />
                <meta name="theme-color" content="#141414" />
            </Head>

            <ThemeProvider>
                {/* Page borders (from old site) */}
                <div className="page-border top" />
                <div className="page-border bottom" />
                <div className="page-border left" />
                <div className="page-border right" />

                {/* Main Layout - stable height to prevent shifting */}
                <div className="flex flex-col min-h-screen-stable">
                    {/* Header with fixed height reservation */}
                    <div className="h-32 lg:h-40" aria-hidden="true" />
                    <Header />

                    {/* Main content area - grows to fill space */}
                    <main className="flex-grow relative">
                        <div key={router.asPath} className="animate-fade-in">
                            <Component {...pageProps} />
                        </div>
                    </main>

                    {/* Footer */}
                    <Footer />
                </div>
            </ThemeProvider>
        </>
    );
}

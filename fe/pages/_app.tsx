/**
 * Main App component
 * Wraps all pages with providers and global styles
 */
import type { AppProps } from 'next/app';
import Head from 'next/head';
import { ThemeProvider } from '@/contexts/ThemeContext';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import '@/styles/globals.css';

export default function App({ Component, pageProps }: AppProps) {
    return (
        <>
            <Head>
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <link rel="manifest" href="/manifest.json" />
                <link rel="apple-touch-icon" href="/icon-192x192.png" />
                <meta name="theme-color" content="#1e3a8a" />
            </Head>

            <ThemeProvider>
                <div className="flex flex-col min-h-screen">
                    <Header />
                    <main className="flex-grow">
                        <Component {...pageProps} />
                    </main>
                    <Footer />
                </div>
            </ThemeProvider>
        </>
    );
}

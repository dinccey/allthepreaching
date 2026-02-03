import Head from 'next/head';
import Link from 'next/link';

export default function NotFoundPage() {
    return (
        <>
            <Head>
                <title>Page Not Found - ALLthePREACHING</title>
            </Head>
            <div className="min-h-[70vh] flex items-center justify-center bg-gradient-to-b from-scheme-e-bg to-scheme-c-bg px-4 py-16">
                <div className="card card-gradient max-w-3xl w-full text-center">
                    <p className="text-sm uppercase tracking-[0.3em] text-secondary-light/80">404</p>
                    <h1 className="text-3xl md:text-5xl font-bold mt-4 mb-3 text-scheme-e-heading">
                        This page went missing.
                    </h1>
                    <p className="text-scheme-e-text/90 max-w-xl mx-auto mb-8">
                        The page you are looking for might have moved, or the link could be broken.
                        Try one of the options below to get back on track.
                    </p>

                    <div className="flex flex-wrap justify-center gap-4">
                        <Link href="/" className="btn-primary">
                            Go to Home
                        </Link>
                        <Link href="/videos" className="btn-secondary">
                            Browse Videos
                        </Link>
                        <Link href="/search" className="btn-accent">
                            Search the Archive
                        </Link>
                    </div>
                </div>
            </div>
        </>
    );
}

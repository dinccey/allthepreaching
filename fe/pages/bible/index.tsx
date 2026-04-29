import { useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';

const DEFAULT_BIBLE_PATH = '/bible/en/genesis/1';
const LAST_BIBLE_POSITION_KEY = 'atp_bible_last_position';

export default function BibleIndexPage() {
    const router = useRouter();

    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }

        const lastPosition = window.localStorage.getItem(LAST_BIBLE_POSITION_KEY);
        const target = lastPosition && lastPosition.startsWith('/bible/') ? lastPosition : DEFAULT_BIBLE_PATH;
        router.replace(target);
    }, [router]);

    return (
        <>
            <Head>
                <title>Bible - ALLthePREACHING</title>
            </Head>
            <div className="container mx-auto px-4 py-12">
                <div className="rounded-3xl border border-primary/20 bg-scheme-c-bg/60 p-8 text-center shadow-lg">
                    <h1 className="text-3xl font-bold text-scheme-e-heading">Opening Bible reader...</h1>
                    <p className="mt-3 text-scheme-e-text/75">Redirecting to your last reading position.</p>
                    <Link href={DEFAULT_BIBLE_PATH} className="mt-6 inline-flex rounded-full bg-primary px-6 py-3 font-semibold text-scheme-c-bg">
                        Open Genesis 1
                    </Link>
                </div>
            </div>
        </>
    );
}
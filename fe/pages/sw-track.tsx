import Head from 'next/head';
import Link from 'next/link';

export default function SoulwinningTrackerPage() {
    return (
        <>
            <Head>
                <title>Soulwinning Tracker - ALLthePREACHING</title>
                <meta name="description" content="Track your soulwinning dates, hours, and salvations." />
            </Head>

            <section className="py-16 md:py-24 bg-gradient-to-b from-scheme-e-bg to-scheme-c-bg">
                <div className="container mx-auto px-4">
                    <div className="card card-gradient max-w-4xl mx-auto text-center">
                        <h1 className="text-3xl md:text-4xl font-bold mb-4">
                            soulwinning <span className="highlight">tracker</span>
                        </h1>
                        <p className="text-scheme-e-text/90 text-lg mb-8">
                            &rarr; track your dates hours &amp; salvations throughout the years &larr;
                        </p>

                        <div className="space-y-4">
                            <Link
                                href="/docs/SW_Tracker.xlsx"
                                className="btn-primary inline-flex items-center justify-center"
                                target="_blank"
                            >
                                download the spreadsheet now!
                            </Link>

                            <div>
                                <Link
                                    href="https://www.youtube.com/c/RomansRoad"
                                    target="_blank"
                                    className="text-scheme-e-text/90 hover:text-primary transition-colors duration-300"
                                >
                                    original credit &amp; thanks to the creator of the youtube channel:
                                    <span className="highlight"> romans road</span>
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        </>
    );
}

import Link from 'next/link';

export default function SoulwinningLinks() {
    return (
        <section className="py-10">
            <div className="container mx-auto px-4">
                <div className="card card-gradient max-w-4xl mx-auto text-center">
                    <div className="space-y-4">
                        <Link
                            href="https://flipbookpdf.net/web/site/8073761ea240888c8d70d8703b267fb30e9f0538202208.pdf.html"
                            target="_blank"
                            className="block text-base md:text-lg text-scheme-e-text hover:text-primary transition-colors duration-300"
                        >
                            download our soulwinning booklet <span className="highlight">click here</span>!
                        </Link>
                        <Link
                            href="/sw-track"
                            className="block text-base md:text-lg text-scheme-e-text hover:text-primary transition-colors duration-300"
                        >
                            want to track your soulwinning dates hours &amp; salvations?{' '}
                            <span className="highlight">click here</span>!
                        </Link>
                    </div>
                </div>
            </div>
        </section>
    );
}

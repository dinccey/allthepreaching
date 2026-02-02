/**
 * Footer component
 */
export default function Footer() {
    return (
        <footer className="bg-gray-100 dark:bg-dark-card mt-12 py-8">
            <div className="container mx-auto px-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* About */}
                    <div>
                        <h3 className="font-bold text-lg mb-3">ALLthePREACHING</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            KJV-only Independent Fundamental Baptist preaching from faithful pastors
                            who preach the whole counsel of God.
                        </p>
                    </div>

                    {/* Quick Links */}
                    <div>
                        <h3 className="font-bold text-lg mb-3">Quick Links</h3>
                        <ul className="space-y-2 text-sm">
                            <li>
                                <a href="/" className="text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400">
                                    Home
                                </a>
                            </li>
                            <li>
                                <a href="/preachers" className="text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400">
                                    Preachers
                                </a>
                            </li>
                            <li>
                                <a href="/about" className="text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400">
                                    About
                                </a>
                            </li>
                            <li>
                                <a href="/api/rss" className="text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400">
                                    RSS Feed
                                </a>
                            </li>
                        </ul>
                    </div>

                    {/* Resources */}
                    <div>
                        <h3 className="font-bold text-lg mb-3">Resources</h3>
                        <ul className="space-y-2 text-sm">
                            <li>
                                <a href="/category/salvation" className="text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400">
                                    The Bible Way to Heaven
                                </a>
                            </li>
                            <li>
                                <a href="/category/documentaries" className="text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400">
                                    Documentaries
                                </a>
                            </li>
                        </ul>
                    </div>
                </div>

                <div className="border-t dark:border-gray-700 mt-8 pt-8 text-center text-sm text-gray-600 dark:text-gray-400">
                    <p>&copy; {new Date().getFullYear()} ALLthePREACHING.com. All rights reserved.</p>
                    <p className="mt-2">King James Bible - The preserved Word of God</p>
                </div>
            </div>
        </footer>
    );
}

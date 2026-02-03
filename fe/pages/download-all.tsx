import Head from 'next/head';

export default function DownloadAllPage() {
    return (
        <>
            <Head>
                <title>Rclone Tutorial - AllThePreaching.com Archive</title>
                <meta name="description" content="Download the full ALLthePREACHING archive using rclone." />
            </Head>

            <section className="bg-scheme-e-bg text-scheme-e-text py-16 border-b border-primary/10">
                <div className="container mx-auto px-6">
                    <div className="max-w-4xl">
                        <h1 className="text-3xl md:text-4xl font-bold text-scheme-e-heading">Download the Full Archive</h1>
                        <p className="mt-4 text-base md:text-lg text-scheme-e-text/80">
                            Download a full offline copy of the <strong>AllThePreaching.com</strong> archive using the
                            <span className="inline-flex items-center mx-2 px-2 py-0.5 rounded border border-primary/20 bg-scheme-c-bg/60 text-sm">rclone</span>
                            command-line utility. It works on Windows, macOS, Linux, BSD, and more.
                        </p>
                    </div>

                    <div className="mt-10 bg-scheme-c-bg/40 border border-primary/10 rounded-2xl p-6 md:p-10 shadow-sm">
                        <div className="space-y-8 text-sm md:text-base leading-relaxed text-scheme-e-text">
                            <section>
                                <h2 className="text-xl md:text-2xl font-bold text-scheme-e-heading">1) Install rclone</h2>
                                <p className="mt-3 text-scheme-e-text/80">
                                    Download rclone from
                                    <a className="ml-1 text-primary hover:underline" href="https://rclone.org/downloads/">rclone.org/downloads</a>
                                    , or follow the install docs at
                                    <a className="ml-1 text-primary hover:underline" href="https://rclone.org/install/">rclone.org/install</a>.
                                    It can also be compiled from source or installed from most repositories.
                                </p>
                                <p className="mt-3 text-scheme-e-text/80">Once installed, confirm it works:</p>
                                <pre className="mt-3 rounded-lg bg-scheme-c-bg/70 border border-primary/20 p-4 text-sm md:text-base text-scheme-e-text overflow-x-auto">rclone version</pre>
                                <p className="mt-3 text-scheme-e-text/80">
                                    If you see “command not found”, ensure rclone is in your default PATH.
                                </p>
                            </section>

                            <section>
                                <h2 className="text-xl md:text-2xl font-bold text-scheme-e-heading">2) Configure the archive source</h2>
                                <p className="mt-3 text-scheme-e-text/80">Run the configuration wizard:</p>
                                <pre className="mt-3 rounded-lg bg-scheme-c-bg/70 border border-primary/20 p-4 text-sm md:text-base text-scheme-e-text overflow-x-auto">rclone config</pre>
                                <p className="mt-3 text-scheme-e-text/80">Choose “n” to add a new remote.</p>
                                <pre className="mt-3 rounded-lg bg-scheme-c-bg/70 border border-primary/20 p-4 text-sm md:text-base text-scheme-e-text overflow-x-auto">
                                    {`No remotes found, make a new one?
 n) New remote
 s) Set configuration password
 q) Quit config
 n/s/q> n`}
                                </pre>
                                <p className="mt-3 text-scheme-e-text/80">
                                    Name the remote <span className="px-1.5 py-0.5 rounded border border-primary/20 bg-scheme-c-bg/60 text-sm">atp</span>:
                                </p>
                                <pre className="mt-3 rounded-lg bg-scheme-c-bg/70 border border-primary/20 p-4 text-sm md:text-base text-scheme-e-text overflow-x-auto">{`Enter name for new remote.
name> atp`}</pre>
                                <p className="mt-3 text-scheme-e-text/80">
                                    For the storage backend, type <span className="px-1.5 py-0.5 rounded border border-primary/20 bg-scheme-c-bg/60 text-sm">http</span>:
                                </p>
                                <pre className="mt-3 rounded-lg bg-scheme-c-bg/70 border border-primary/20 p-4 text-sm md:text-base text-scheme-e-text overflow-x-auto">
                                    {`Option Storage.
Type of storage to configure.
Choose a number from below, or type in your own value
[...]
Storage> http`}
                                </pre>
                                <p className="mt-3 text-scheme-e-text/80">When asked for the URL, enter:</p>
                                <pre className="mt-3 rounded-lg bg-scheme-c-bg/70 border border-primary/20 p-4 text-sm md:text-base text-scheme-e-text overflow-x-auto">
                                    {`Option url.
URL of HTTP host to connect to.
Enter a value.
url> https://www.kjv1611only.com/video`}
                                </pre>
                                <p className="mt-3 text-scheme-e-text/80">Press Enter for the next prompt:</p>
                                <pre className="mt-3 rounded-lg bg-scheme-c-bg/70 border border-primary/20 p-4 text-sm md:text-base text-scheme-e-text overflow-x-auto">
                                    {`Option no_escape.
Do not escape URL metacharacters in path names.
Enter a boolean value (true or false). Press Enter for the default (false).
no_escape>`}
                                </pre>
                                <p className="mt-3 text-scheme-e-text/80">
                                    When asked to edit advanced config, press “n”, confirm the configuration is OK,
                                    then press “q” to quit.
                                </p>
                            </section>

                            <section>
                                <h2 className="text-xl md:text-2xl font-bold text-scheme-e-heading">3) Choose a download location</h2>
                                <p className="mt-3 text-scheme-e-text/80">
                                    The archive is at least 3TB as of 2025 and continues to grow. Choose a destination
                                    with plenty of free space. Example locations:
                                </p>
                                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div className="rounded-lg border border-primary/10 bg-scheme-c-bg/60 px-4 py-3 text-sm">
                                        <div className="text-scheme-e-heading font-semibold">Linux</div>
                                        <div className="text-scheme-e-text/80">/home/kjv/Downloads</div>
                                    </div>
                                    <div className="rounded-lg border border-primary/10 bg-scheme-c-bg/60 px-4 py-3 text-sm">
                                        <div className="text-scheme-e-heading font-semibold">macOS</div>
                                        <div className="text-scheme-e-text/80">/Users/kjv/Downloads</div>
                                    </div>
                                    <div className="rounded-lg border border-primary/10 bg-scheme-c-bg/60 px-4 py-3 text-sm">
                                        <div className="text-scheme-e-heading font-semibold">Windows</div>
                                        <div className="text-scheme-e-text/80">C:\\Users\\kjv</div>
                                    </div>
                                </div>
                            </section>

                            <section>
                                <h2 className="text-xl md:text-2xl font-bold text-scheme-e-heading">4) Download the archive</h2>
                                <p className="mt-3 text-scheme-e-text/80">
                                    Copy everything (videos, subtitles, MP3 audio, and thumbnails):
                                </p>
                                <pre className="mt-3 rounded-lg bg-scheme-c-bg/70 border border-primary/20 p-4 text-sm md:text-base text-scheme-e-text overflow-x-auto">rclone -P copy atp: /home/kjv/Downloads</pre>
                                <p className="mt-3 text-scheme-e-text/80">Only download MP4 files:</p>
                                <pre className="mt-3 rounded-lg bg-scheme-c-bg/70 border border-primary/20 p-4 text-sm md:text-base text-scheme-e-text overflow-x-auto">rclone -P copy --include "*mp4" atp: /home/kjv/Downloads</pre>
                                <p className="mt-3 text-scheme-e-text/80">
                                    Use <span className="px-1.5 py-0.5 rounded border border-primary/20 bg-scheme-c-bg/60 text-sm">--exclude</span> to filter out
                                    MP3s or <span className="px-1.5 py-0.5 rounded border border-primary/20 bg-scheme-c-bg/60 text-sm">.vtt</span> subtitle files.
                                </p>
                                <p className="mt-3 text-scheme-e-text/80">
                                    Run the same command later to download new files added since your last sync.
                                </p>
                            </section>
                        </div>
                    </div>
                </div>
            </section>
        </>
    );
}

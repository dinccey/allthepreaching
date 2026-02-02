import Head from 'next/head';

export default function DownloadAllPage() {
    return (
        <>
            <Head>
                <title>Rclone Tutorial - AllThePreaching.com Archive</title>
                <meta name="description" content="Download the full ALLthePREACHING archive using rclone." />
            </Head>

            <div className="download-all-page">
                <div className="download-all-box">
                    <p>
                        To download a copy of the whole <strong>AllThePreaching.com</strong> archive,
                        you can use the <code>rclone</code> command-line utility. It works on all major
                        operating systems like Windows, Mac, Linux, BSD, etc.
                    </p>

                    <p>
                        Download rclone here:{' '}
                        <a href="https://rclone.org/downloads/">https://rclone.org/downloads/</a>
                    </p>
                    <p>
                        Basic documentation:{' '}
                        <a href="https://rclone.org/install/">https://rclone.org/install/</a>
                    </p>

                    <p>It can also be compiled from source or installed from most repositories.</p>

                    <p>Once you have it installed, open a terminal or command prompt and run:</p>
                    <pre>rclone version</pre>

                    <p>
                        If you get an error about the command not being found, you need to
                        ensure that it's available in your default PATH variable.
                    </p>

                    <p>Run the following to initially configure your download source:</p>
                    <pre>rclone config</pre>

                    <p>You will be prompted to add a new one.</p>

                    <pre>
                        {`No remotes found, make a new one?
 n) New remote
 s) Set configuration password
 q) Quit config
 n/s/q> n`}
                    </pre>

                    <p>
                        Press &quot;n&quot; to add a new remote source and then give it a name.
                        We'll use &quot;atp&quot; for the example.
                    </p>

                    <pre>{`Enter name for new remote.
name> atp`}</pre>

                    <p>Next it will ask for the storage backend. Type &quot;http&quot; at the prompt.</p>

                    <pre>
                        {`Option Storage.
Type of storage to configure.
Choose a number from below, or type in your own value
[...]
Storage> http`}
                    </pre>

                    <p>It will ask for a URL. Input the following:</p>

                    <pre>
                        {`Option url.
URL of HTTP host to connect to.
Enter a value.
url> https://www.kjv1611only.com/video`}
                    </pre>

                    <p>Simply press enter at the next prompt.</p>

                    <pre>
                        {`Option no_escape.
Do not escape URL metacharacters in path names.
Enter a boolean value (true or false). Press Enter for the default (false).
no_escape>`}
                    </pre>

                    <p>
                        When asked to edit the advanced config, press &quot;n&quot; and finish by confirming
                        that the configuration is OK. You can then hit &quot;q&quot; when prompted to quit
                        and exit.
                    </p>

                    <p>
                        Now you should decide where you want to store the archive.
                        It's at least 3TB as of 2025 and will continue to grow. For this example,
                        we'll use <code>/home/kjv/Downloads</code> as the local directory where
                        everything will be put. You can substitute that path with something like
                        <code>/Users/kjv/Downloads</code> on macOS or <code>C:\\Users\\kjv</code> on Windows.
                    </p>

                    <p>
                        If you want to copy the entire archive, including all the subtitle
                        files, MP3 audio versions, and thumbnail images, run the following:
                    </p>

                    <pre>rclone -P copy atp: /home/kjv/Downloads</pre>

                    <p>To download only the MP4 video files, run the following:</p>

                    <pre>rclone -P copy --include "*mp4" atp: /home/kjv/Downloads</pre>

                    <p>
                        The <code>--exclude</code> option can also be used if you only want to filter out
                        MP3s or the <code>.vtt</code> subtitle files.
                    </p>

                    <p>
                        The same command can be run later on to download newer files that have
                        been added since the last time it was run.
                    </p>
                </div>
            </div>

            <style jsx global>{`
                .download-all-page {
                    background-color: #0c0c0c;
                    color: #f2f2f2;
                    margin: 15px auto;
                    padding: 1.5rem 1rem 4rem;
                }

                @media (min-width: 800px) {
                    .download-all-page {
                        max-width: 85%;
                    }
                }

                .download-all-page a {
                    color: #e6c16d;
                }

                .download-all-page a:hover {
                    color: #f2f2f2;
                    text-decoration: underline;
                }

                .download-all-page pre {
                    background-color: #1a1a1a;
                    padding: 0.5em;
                    overflow-x: auto;
                    border: 1px solid #e6c16d;
                    margin-top: 0.75rem;
                    margin-bottom: 0.75rem;
                }

                .download-all-box {
                    border: 1px solid #e6c16d;
                    background-color: #121212;
                    padding: 0 1em 1em;
                    margin-bottom: 1em;
                }

                .download-all-box p {
                    margin: 0.85rem 0;
                }
            `}</style>
        </>
    );
}

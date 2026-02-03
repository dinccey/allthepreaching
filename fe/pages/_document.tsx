import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
    return (
        <Html lang="en">
            <Head>
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                <link
                    href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Merriweather:wght@700&display=swap"
                    rel="stylesheet"
                />
                <meta name="color-scheme" content="light dark" />
            </Head>
            <body>
                <script
                    dangerouslySetInnerHTML={{
                        __html: `(function(){try{var t=localStorage.getItem('theme');var m=document.cookie.match(/(?:^|; )theme=(light|dark)/);var c=m?m[1]:null;var v=(t==='light'||t==='dark')?t:((c==='light'||c==='dark')?c:null);if(!v){v=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}var r=document.documentElement;r.classList.remove('light','dark');r.classList.add(v);r.style.colorScheme=v;}catch(e){}})();`,
                    }}
                />
                <Main />
                <NextScript />
            </body>
        </Html>
    );
}

import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const PROMPT_STORAGE_KEY = 'atp_pwa_prompt_dismissed';

export default function PwaInstallPrompt() {
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [isVisible, setIsVisible] = useState(false);
    const [isIos, setIsIos] = useState(false);
    const [isStandalone, setIsStandalone] = useState(false);
    const [isDismissed, setIsDismissed] = useState(false);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        if (window.localStorage.getItem(PROMPT_STORAGE_KEY) === '1') {
            setIsDismissed(true);
            setIsVisible(false);
            return;
        }

        const userAgent = window.navigator.userAgent || '';
        const ios = /iphone|ipad|ipod/i.test(userAgent);
        setIsIos(ios);

        const standaloneMatch = window.matchMedia('(display-mode: standalone)').matches;
        const iosStandalone = (window.navigator as any).standalone === true;
        setIsStandalone(standaloneMatch || iosStandalone);

        const handleBeforeInstallPrompt = (event: Event) => {
            event.preventDefault();
            setDeferredPrompt(event as BeforeInstallPromptEvent);
            setIsVisible(true);
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        };
    }, []);

    useEffect(() => {
        if (isStandalone) {
            setIsVisible(false);
        }
    }, [isStandalone]);

    if (isStandalone || isDismissed) return null;

    const showIos = isIos && !deferredPrompt;
    if (!showIos && !deferredPrompt && !isVisible) return null;

    const handleInstall = async () => {
        if (!deferredPrompt) return;
        await deferredPrompt.prompt();
        await deferredPrompt.userChoice;
        setDeferredPrompt(null);
        setIsVisible(false);
        setIsDismissed(true);
        if (typeof window !== 'undefined') {
            window.localStorage.setItem(PROMPT_STORAGE_KEY, '1');
        }
    };

    const handleDismiss = () => {
        setIsVisible(false);
        setIsDismissed(true);
        if (typeof window !== 'undefined') {
            window.localStorage.setItem(PROMPT_STORAGE_KEY, '1');
        }
    };

    return (
        <div className="fixed bottom-4 left-1/2 z-50 w-[min(92vw,420px)] -translate-x-1/2 rounded-2xl border border-primary/40 bg-scheme-b-bg/95 p-4 text-scheme-e-text shadow-xl backdrop-blur md:bottom-6">
            <div className="flex items-start gap-3">
                <img
                    src="/icons/ATP_logo.png"
                    alt="ALLthePREACHING"
                    className="h-12 w-12 rounded-xl border border-primary/40 object-contain bg-white"
                />
                <div className="flex-1">
                    <p className="text-sm font-semibold">Add allthepreaching to your home screen</p>
                    {showIos ? (
                        <p className="text-xs text-scheme-e-text/80 mt-1">
                            On iPhone, tap <strong>Share</strong> and choose <strong>Add to Home Screen</strong>.
                        </p>
                    ) : (
                        <p className="text-xs text-scheme-e-text/80 mt-1">
                            Get faster access and offline support by installing the app.
                        </p>
                    )}
                </div>
                <button
                    type="button"
                    onClick={handleDismiss}
                    className="text-scheme-e-text/70 hover:text-scheme-e-text"
                    aria-label="Dismiss install prompt"
                >
                    ✕
                </button>
            </div>
            {!showIos && (
                <div className="mt-3 flex items-center justify-end gap-2">
                    <button
                        type="button"
                        onClick={handleInstall}
                        className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-scheme-c-bg hover:bg-primary/90"
                    >
                        Install
                    </button>
                </div>
            )}
        </div>
    );
}

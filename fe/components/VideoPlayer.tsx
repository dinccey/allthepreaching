/**
 * Video.js player component
 * Supports captions, speed control, quality selection, wake lock
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';
import type Player from 'video.js/dist/types/player';
import type TextTrack from 'video.js/dist/types/tracks/text-track';
import type TextTrackList from 'video.js/dist/types/tracks/text-track-list';

interface VideoPlayerProps {
    src: string;
    poster?: string;
    mediaTitle?: string;
    mediaArtist?: string;
    onEnded?: () => void;
    onTimeUpdate?: (time: number) => void;
    startTime?: number;
    portrait?: boolean;
    tracks?: Array<{
        kind?: string;
        label?: string;
        src: string;
        srclang?: string;
        default?: boolean;
    }>;
}

export default function VideoPlayer({
    src,
    poster,
    mediaTitle,
    mediaArtist,
    onEnded,
    onTimeUpdate,
    startTime = 0,
    portrait = false,
    tracks,
}: VideoPlayerProps) {
    const videoRef = useRef<HTMLDivElement>(null);
    const playerRef = useRef<Player | null>(null);
    const eventsRef = useRef({ onEnded, onTimeUpdate });
    const [wakeLock, setWakeLock] = useState<any>(null);
    const [autoPortrait, setAutoPortrait] = useState(false);
    const [actionIndicator, setActionIndicator] = useState<{
        type: 'play' | 'pause' | 'backward' | 'forward';
        count?: number;
        id: number;
    } | null>(null);

    // Remove indicator after animation
    useEffect(() => {
        if (actionIndicator) {
            const timer = setTimeout(() => {
                setActionIndicator(null);
            }, 600);
            return () => clearTimeout(timer);
        }
    }, [actionIndicator]);

    useEffect(() => {
        eventsRef.current = { onEnded, onTimeUpdate };
    }, [onEnded, onTimeUpdate]);

    const trackList = useMemo(() => tracks || [], [tracks]);

    const ensureCaptionsToggle = () => {
        const ControlBar = videojs.getComponent('ControlBar');
        const Button = videojs.getComponent('Button');

        if (!ControlBar || !Button || videojs.getComponent('CaptionsToggleButton')) {
            return;
        }

        class CaptionsToggleButton extends Button {
            constructor(playerInstance: any, options: any) {
                super(playerInstance, options);
                // @ts-ignore - video.js Button has controlText at runtime
                this.controlText('Toggle captions');
                this.addClass('vjs-captions-toggle');
                this.updateState();
            }

            handleClick() {
                const tracks: TextTrackList = this.player().textTracks();
                const captionTracks: TextTrack[] = Array.from<TextTrack>(
                    tracks as unknown as ArrayLike<TextTrack>
                ).filter(
                    (track) => (track as any).kind === 'captions' || (track as any).kind === 'subtitles'
                );

                if (!captionTracks.length) return;

                const anyShowing = captionTracks.some(
                    (track) => (track as any).mode === 'showing'
                );

                captionTracks.forEach((track) => {
                    (track as any).mode = anyShowing ? 'disabled' : 'showing';
                });

                this.updateState();
            }

            updateState() {
                const tracks: TextTrackList = this.player().textTracks();
                const captionTracks: TextTrack[] = Array.from<TextTrack>(
                    tracks as unknown as ArrayLike<TextTrack>
                ).filter(
                    (track) => (track as any).kind === 'captions' || (track as any).kind === 'subtitles'
                );

                const isOn = captionTracks.some(
                    (track) => (track as any).mode === 'showing'
                );

                this.toggleClass('is-on', isOn);
                this.toggleClass('is-disabled', captionTracks.length === 0);
            }
        }

        videojs.registerComponent('CaptionsToggleButton', CaptionsToggleButton);
    };

    // Wake Lock API to prevent screen from sleeping
    const requestWakeLock = async () => {
        try {
            if (typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
                const lock = await (navigator as any).wakeLock.request('screen');
                setWakeLock(lock);
                console.log('Wake Lock acquired');
            }
        } catch (err) {
            console.warn('Wake Lock failed:', err);
        }
    };

    const releaseWakeLock = () => {
        if (wakeLock) {
            wakeLock.release();
            setWakeLock(null);
            console.log('Wake Lock released');
        }
    };

    // Player Initialization & Update
    useEffect(() => {
        if (!playerRef.current) {
            if (!videoRef.current) return;

            ensureCaptionsToggle();

            const videoElement = document.createElement('video-js');
            videoElement.classList.add('vjs-big-play-centered', 'vjs-theme-atp');
            videoElement.setAttribute('playsInline', 'true');
            videoRef.current.appendChild(videoElement);

            const player = videojs(videoElement, {
                controls: true,
                responsive: true,
                fluid: true,
                aspectRatio: '16:9',
                textTrackSettings: false,
                userActions: {
                    click: false,
                    doubleClick: false,
                },
                playbackRates: [0.5, 0.75, 1, 1.25, 1.5, 2],
                controlBar: {
                    children: [
                        'playToggle',
                        'volumePanel',
                        'currentTimeDisplay',
                        'timeDivider',
                        'durationDisplay',
                        'progressControl',
                        'CaptionsToggleButton',
                        'playbackRateMenuButton',
                        'pictureInPictureToggle',
                        'fullscreenToggle',
                    ],
                },
            });
            playerRef.current = player;

            let lastTapTime = 0;
            let tapCount = 0;
            let tapSide = '';
            let tapTimeout: ReturnType<typeof setTimeout> | null = null;

            const handleVideoInteraction = (e: Event) => {
                if ((e.target as HTMLElement).closest('.vjs-control-bar')) return;
                const playerEl = player.el() as HTMLElement;
                if (!playerEl) return;
                const rect = playerEl.getBoundingClientRect();

                let clientX = 0;
                if (e.type === 'touchstart') {
                    const touchEvent = e as TouchEvent;
                    if (!touchEvent.touches || touchEvent.touches.length === 0) return;
                    clientX = touchEvent.touches[0].clientX;
                } else if (e.type === 'click') {
                    const mouseEvent = e as MouseEvent;
                    clientX = mouseEvent.clientX;
                } else {
                    return;
                }

                const width = rect.width;
                const xPos = clientX - rect.left;

                let currentSide = 'middle';
                if (xPos < width * 0.33) {
                    currentSide = 'left';
                } else if (xPos > width * 0.67) {
                    currentSide = 'right';
                }

                if (currentSide === 'middle') {
                    const currentTime = new Date().getTime();
                    // Prevent accidental double clicks from toggling repeatedly
                    if (currentTime - lastTapTime < 300) return;
                    lastTapTime = currentTime;

                    if (player.paused()) {
                        player.play();
                        setActionIndicator({ type: 'play', id: Date.now() });
                    } else {
                        player.pause();
                        setActionIndicator({ type: 'pause', id: Date.now() });
                    }
                    tapCount = 0;
                    return;
                }

                const isLeft = currentSide === 'left';
                const currentTime = new Date().getTime();
                const tapDuration = currentTime - lastTapTime;

                if (tapDuration < 300 && tapSide === currentSide) {
                    tapCount++;
                    // 2 taps = 5s, 3 taps = 10s, 4 taps = 20s, 5 taps = 30s etc
                    let skipAmount = 0;
                    if (tapCount === 2) skipAmount = 5;
                    else if (tapCount === 3) skipAmount = 10;
                    else if (tapCount >= 4) skipAmount = (tapCount - 2) * 10;

                    setActionIndicator({ type: isLeft ? 'backward' : 'forward', count: skipAmount / 5, id: Date.now() });

                    if (tapTimeout) clearTimeout(tapTimeout);

                    tapTimeout = setTimeout(() => {
                        const currentPos = player.currentTime();
                        if (typeof currentPos === 'number') {
                            if (isLeft) {
                                player.currentTime(Math.max(0, currentPos - skipAmount));
                            } else {
                                player.currentTime(Math.min(player.duration() || 0, currentPos + skipAmount));
                            }
                        }
                        tapCount = 0;
                    }, 400); // Wait slightly longer before committing skip to allow more taps
                } else {
                    tapCount = 1;
                    tapSide = currentSide;
                }
                lastTapTime = currentTime;
            };

            const playerEl = player.el() as HTMLElement;
            if (playerEl) {
                playerEl.addEventListener('touchstart', handleVideoInteraction);
                playerEl.addEventListener('click', handleVideoInteraction);
            }

            const handleKeyDown = (e: KeyboardEvent) => {
                if (!player) return;
                const rootEl = player.el() as HTMLElement;
                const techEl = player.tech()?.el() as HTMLElement | undefined;

                // Only handle if we have focus on body, the player, or the video element itself
                const active = document.activeElement;
                if (active !== rootEl && active !== document.body && active !== techEl && active?.tagName !== 'BUTTON') {
                    return;
                }
                if (e.key === 'ArrowLeft') {
                    const currentPos = player.currentTime();
                    if (typeof currentPos === 'number') {
                        player.currentTime(Math.max(0, currentPos - 5));
                        setActionIndicator({ type: 'backward', count: 1, id: Date.now() });
                    }
                    e.preventDefault();
                } else if (e.key === 'ArrowRight') {
                    const currentPos = player.currentTime();
                    if (typeof currentPos === 'number') {
                        player.currentTime(Math.min(player.duration() || 0, currentPos + 5));
                        setActionIndicator({ type: 'forward', count: 1, id: Date.now() });
                    }
                    e.preventDefault();
                } else if (e.key === ' ' || e.key === 'k') {
                    if (player.paused()) {
                        player.play();
                        setActionIndicator({ type: 'play', id: Date.now() });
                    } else {
                        player.pause();
                        setActionIndicator({ type: 'pause', id: Date.now() });
                    }
                    e.preventDefault();
                }
            };

            window.addEventListener('keydown', handleKeyDown);

            const updatePortrait = () => {
                const width = player.videoWidth?.();
                const height = player.videoHeight?.();
                if (typeof width === 'number' && typeof height === 'number' && width > 0 && height > 0) {
                    const isPortrait = height > width;
                    setAutoPortrait(isPortrait);
                    if (isPortrait) {
                        player.aspectRatio('16:9');
                    }
                }
            };
            player.on('loadedmetadata', updatePortrait);
            player.on('loadeddata', updatePortrait);

            player.on('ended', () => {
                eventsRef.current.onEnded?.();
                releaseWakeLock();
            });
            player.on('timeupdate', () => {
                const ct = player.currentTime();
                if (typeof ct === 'number') {
                    eventsRef.current.onTimeUpdate?.(ct);
                }
            });
            player.on('play', () => requestWakeLock());
            player.on('pause', () => releaseWakeLock());
            player.on('loadedmetadata', () => {
                const button = player.getChild('ControlBar')?.getChild('CaptionsToggleButton') as any;
                if (button?.updateState) button.updateState();
            });

            // Handle listener cleanup on disposal
            player.on('dispose', () => {
                if (playerEl) {
                    playerEl.removeEventListener('touchstart', handleVideoInteraction);
                    playerEl.removeEventListener('click', handleVideoInteraction);
                }
                window.removeEventListener('keydown', handleKeyDown);
                releaseWakeLock();
            });

            player.src({ src, type: 'video/mp4' });
            if (poster) player.poster(poster);
            if (startTime > 0) player.currentTime(startTime);

        } else {
            const player = playerRef.current;
            const currentSrc = player.currentSrc();
            if (currentSrc !== src) {
                player.src({ src, type: 'video/mp4' });
                if (poster) player.poster(poster);
                if (startTime > 0) player.currentTime(startTime);
            } else if (poster && player.poster() !== poster) {
                player.poster(poster);
            }
        }
    }, [src, poster, startTime]);

    // Handle tracks externally
    useEffect(() => {
        const player = playerRef.current;
        if (!player || player.isDisposed()) return;

        const registeredTracks: Array<ReturnType<typeof player.addRemoteTextTrack> | undefined> = [];
        trackList.forEach(track => {
            if (!track?.src) return;
            const added = player.addRemoteTextTrack({
                kind: track.kind || 'subtitles',
                label: track.label,
                src: track.src,
                srclang: track.srclang,
                default: track.default,
            }, false);
            registeredTracks.push(added);
        });

        return () => {
            if (!player || player.isDisposed()) return;
            registeredTracks.forEach((handle) => {
                const trackHandle = handle as { track?: TextTrack } | undefined;
                if (trackHandle?.track) {
                    player.removeRemoteTextTrack(trackHandle.track);
                }
            });
        };
    }, [trackList]); // Runs only when trackList changes

    // Media Session
    useEffect(() => {
        if (typeof navigator === 'undefined' || !(navigator as any).mediaSession) {
            return;
        }

        const artworkSrc = poster || '';
        const metadata = new window.MediaMetadata({
            title: mediaTitle || 'ALLthePREACHING',
            artist: mediaArtist || 'ALLthePREACHING',
            album: 'ALLthePREACHING',
            artwork: artworkSrc
                ? [
                    { src: artworkSrc, sizes: '96x96', type: 'image/png' },
                    { src: artworkSrc, sizes: '128x128', type: 'image/png' },
                    { src: artworkSrc, sizes: '192x192', type: 'image/png' },
                    { src: artworkSrc, sizes: '256x256', type: 'image/png' },
                    { src: artworkSrc, sizes: '384x384', type: 'image/png' },
                    { src: artworkSrc, sizes: '512x512', type: 'image/png' },
                ]
                : [],
        });

        (navigator as any).mediaSession.metadata = metadata;

        const player = playerRef.current;
        if (!player) {
            return;
        }

        try {
            (navigator as any).mediaSession.setActionHandler('play', () => player.play());
            (navigator as any).mediaSession.setActionHandler('pause', () => player.pause());
            (navigator as any).mediaSession.setActionHandler('seekbackward', (details: any) => {
                const offset = details?.seekOffset ?? 10;
                const current = player.currentTime() ?? 0;
                player.currentTime(Math.max(0, current - offset));
            });
            (navigator as any).mediaSession.setActionHandler('seekforward', (details: any) => {
                const offset = details?.seekOffset ?? 10;
                const current = player.currentTime() ?? 0;
                player.currentTime(current + offset);
            });
        } catch {
            // ignore unsupported actions
        }
    }, [poster, mediaTitle, mediaArtist]);

    // Cleanup player on unmount
    useEffect(() => {
        const player = playerRef.current;
        return () => {
            if (player && !player.isDisposed()) {
                player.dispose();
                playerRef.current = null;
            }
        };
    }, []);

    const isPortrait = portrait || autoPortrait;

    return (
        <div className={`video-player relative ${isPortrait ? 'portrait' : ''}`}>
            {actionIndicator && (
                <div className={`action-indicator ${actionIndicator.type}`} key={actionIndicator.id}>
                    <div className="icon">
                        {actionIndicator.type === 'play' && <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>}
                        {actionIndicator.type === 'pause' && <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>}
                        {actionIndicator.type === 'backward' && <svg viewBox="0 0 24 24" fill="currentColor"><path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z" /></svg>}
                        {actionIndicator.type === 'forward' && <svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z" /></svg>}
                    </div>
                    {(actionIndicator.type === 'backward' || actionIndicator.type === 'forward') && (
                        <div className="skip-text">{actionIndicator.count ? actionIndicator.count * 5 : 5}s</div>
                    )}
                </div>
            )}
            <div data-vjs-player ref={videoRef} />

            <style jsx>{`
        .video-player {
          width: 100%;
          max-width: 100%;
          position: relative;
        }

                .action-indicator {
                    position: absolute;
                    top: 50%;
                    transform: translateY(-50%);
                    pointer-events: none;
                    z-index: 50;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    background: rgba(0, 0, 0, 0.5);
                    border-radius: 50%;
                    width: 80px;
                    height: 80px;
                    animation: popFade 0.6s ease-out forwards;
                }

                .action-indicator.play, .action-indicator.pause {
                    left: 50%;
                    transform: translate(-50%, -50%);
                }

                .action-indicator.backward {
                    left: 15%;
                }

                .action-indicator.forward {
                    right: 15%;
                }

                .action-indicator .icon {
                    width: 36px;
                    height: 36px;
                }

                .action-indicator .skip-text {
                    font-size: 14px;
                    font-weight: bold;
                    margin-top: 4px;
                }

                @keyframes popFade {
                    0% {
                        opacity: 1;
                        transform: scale(1) translate(var(--translateX, 0), -50%);
                    }
                    100% {
                        opacity: 0;
                        transform: scale(1.5) translate(var(--translateX, 0), -50%);
                    }
                }

                .action-indicator.play, .action-indicator.pause {
                    --translateX: -50%;
                }

                .action-indicator.backward, .action-indicator.forward {
                    --translateX: 0;
                }
        
                .video-player.portrait {
                    max-width: 100%;
                }

                .video-player :global(.video-js) {
                    background: #000;
                }

                .video-player :global(.vjs-theme-atp .vjs-control-bar) {
                    background: rgba(20, 20, 20, 0.75);
                    border-top: 1px solid rgba(219, 171, 131, 0.2);
                    backdrop-filter: blur(10px);
                }

                .video-player :global(.vjs-theme-atp .vjs-control) {
                    color: #f5e6d6;
                }

                .video-player :global(.vjs-theme-atp .vjs-progress-control .vjs-progress-holder) {
                    background: rgba(255, 255, 255, 0.15);
                }

                .video-player :global(.vjs-theme-atp .vjs-play-progress) {
                    background: #dbab83;
                }

                .video-player :global(.vjs-theme-atp .vjs-volume-level) {
                    background: #dbab83;
                }

                .video-player :global(.vjs-theme-atp .vjs-big-play-button) {
                    border-radius: 999px;
                    border: 2px solid rgba(219, 171, 131, 0.7);
                    background: rgba(20, 20, 20, 0.6);
                    color: #dbab83;
                }

                .video-player :global(.vjs-theme-atp .vjs-captions-toggle) {
                    font-size: 0.85rem;
                    font-weight: 600;
                    border-radius: 999px;
                }

                .video-player :global(.vjs-theme-atp .vjs-captions-toggle::before) {
                    content: 'CC';
                    font-weight: 700;
                    font-size: 0.75rem;
                }

                .video-player :global(.vjs-theme-atp .vjs-captions-toggle.is-on) {
                    color: #141414;
                    background: #dbab83;
                }

                .video-player :global(.vjs-theme-atp .vjs-captions-toggle.is-disabled) {
                    opacity: 0.4;
                }

                .video-player :global(.video-js .vjs-tech),
                .video-player :global(.video-js .vjs-poster) {
                    object-fit: contain;
                    background: #000;
                }

                .video-player :global(.vjs-text-track-cue),
                .video-player :global(video::cue) {
                    font-size: 20px !important;
                    line-height: 1.4 !important;
                    color: #fff !important;
                    background-color: transparent !important;
                    text-shadow: 1px 1px 2px #000, -1px -1px 2px #000, 1px -1px 2px #000, -1px 1px 2px #000 !important;
                    padding: 4px 8px !important;
                    border-radius: 0.65rem !important;
                }
        
                @media (max-width: 768px) {
                    .video-player.portrait {
                        max-width: 100%;
                    }

                    .video-player :global(.vjs-theme-atp .vjs-control-bar) {
                        height: 3.25rem;
                    }

                    .video-player :global(.vjs-theme-atp .vjs-control) {
                        width: 3rem;
                    }

                    .video-player :global(.vjs-theme-atp .vjs-button > .vjs-icon-placeholder) {
                        font-size: 1.2rem;
                    }

                    .video-player :global(.vjs-theme-atp .vjs-control-bar .vjs-time-control) {
                        font-size: 0.95rem;
                    }

                    .video-player :global(.vjs-text-track-display) {
                        font-size: 1.2rem;
                        line-height: 1.4;
                    }

                    .video-player :global(.vjs-text-track-cue),
                    .video-player :global(video::cue) {
                        font-size: 30px !important;
                        line-height: 1.5 !important;
                    }

                    .video-player :global(.video-js:not(.vjs-fullscreen) .vjs-text-track-display) {
                        top: 100% !important;
                        bottom: auto !important;
                        transform: translateY(0.75rem);
                        left: 0 !important;
                        right: 0 !important;
                        pointer-events: none;
                        z-index: 20;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        padding: 0.25rem 0.5rem !important;
                        max-width: min(100%, 720px);
                        margin: 0 auto;
                    }

                    .video-player :global(.video-js:not(.vjs-fullscreen).vjs-paused .vjs-text-track-display),
                    .video-player :global(.video-js:not(.vjs-fullscreen).vjs-ended .vjs-text-track-display) {
                        opacity: 0 !important;
                    }

                    .video-player :global(.video-js:not(.vjs-fullscreen) .vjs-text-track-display:empty) {
                        opacity: 0 !important;
                    }
                }
      `}</style>
        </div>
    );
}
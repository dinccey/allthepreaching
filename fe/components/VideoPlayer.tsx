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

                const xPos = clientX - rect.left;
                const isLeft = xPos < rect.width / 2;
                const currentSide = isLeft ? 'left' : 'right';
                const currentTime = new Date().getTime();
                const tapDuration = currentTime - lastTapTime;

                if (tapDuration < 300 && tapSide === currentSide) {
                    tapCount++;
                    const skipAmount = 5 * tapCount;
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
                    }, 300);
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
                if (document.activeElement !== rootEl && document.activeElement !== document.body && document.activeElement?.tagName !== 'BUTTON') {
                    return;
                }
                if (e.key === 'ArrowLeft') {
                    const currentPos = player.currentTime();
                    if (typeof currentPos === 'number') {
                        player.currentTime(Math.max(0, currentPos - 5));
                    }
                    e.preventDefault();
                } else if (e.key === 'ArrowRight') {
                    const currentPos = player.currentTime();
                    if (typeof currentPos === 'number') {
                        player.currentTime(Math.min(player.duration() || 0, currentPos + 5));
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
            const currentSrc = player.src();
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
        <div className={`video-player ${isPortrait ? 'portrait' : ''}`}>
            <div data-vjs-player ref={videoRef} />

            <style jsx>{`
        .video-player {
          width: 100%;
          max-width: 100%;
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
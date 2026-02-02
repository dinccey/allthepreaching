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
    onEnded,
    onTimeUpdate,
    startTime = 0,
    portrait = false,
    tracks,
}: VideoPlayerProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const playerRef = useRef<Player | null>(null);
    const [wakeLock, setWakeLock] = useState<any>(null);
    const [autoPortrait, setAutoPortrait] = useState(false);

    const trackList = useMemo(() => tracks || [], [tracks]);

    useEffect(() => {
        if (!videoRef.current) return;

        // Initialize Video.js
        const player = videojs(videoRef.current, {
            controls: true,
            responsive: true,
            fluid: true,
            aspectRatio: '16:9',
            textTrackSettings: false,
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

        // Set source
        player.src({ src, type: 'video/mp4' });
        if (poster) {
            player.poster(poster);
        }

        // Set start time
        if (startTime > 0) {
            player.currentTime(startTime);
        }

        const registeredTracks: Array<ReturnType<typeof player.addRemoteTextTrack> | undefined> = [];
        trackList.forEach(track => {
            if (!track?.src) {
                return;
            }
            const added = player.addRemoteTextTrack({
                kind: track.kind || 'subtitles',
                label: track.label,
                src: track.src,
                srclang: track.srclang,
                default: track.default,
            }, false);
            registeredTracks.push(added);
        });

        const ControlBar = videojs.getComponent('ControlBar');
        const Button = videojs.getComponent('Button');

        if (ControlBar && Button && !videojs.getComponent('CaptionsToggleButton')) {
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
        }

        // Event listeners
        player.on('ended', () => {
            onEnded?.();
            releaseWakeLock();
        });

        player.on('timeupdate', () => {
            const currentTime = player.currentTime();
            if (typeof currentTime === 'number') {
                onTimeUpdate?.(currentTime);
            }
        });

        player.on('play', () => {
            requestWakeLock();
        });

        player.on('pause', () => {
            releaseWakeLock();
        });

        player.on('loadedmetadata', () => {
            const button = player.getChild('ControlBar')?.getChild('CaptionsToggleButton') as any;
            if (button?.updateState) {
                button.updateState();
            }
        });

        return () => {
            player.off('loadedmetadata', updatePortrait);
            player.off('loadeddata', updatePortrait);
            registeredTracks.forEach((handle) => {
                const trackHandle = handle as { track?: TextTrack } | undefined;
                if (trackHandle?.track) {
                    player.removeRemoteTextTrack(trackHandle.track);
                }
            });

            if (player) {
                player.dispose();
            }
            releaseWakeLock();
        };
    }, [src, poster, trackList, startTime]);

    // Wake Lock API to prevent screen from sleeping
    const requestWakeLock = async () => {
        try {
            if ('wakeLock' in navigator) {
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

    const isPortrait = portrait || autoPortrait;

    return (
        <div className={`video-player ${isPortrait ? 'portrait' : ''}`}>
            <div data-vjs-player>
                <video
                    ref={videoRef}
                    className="video-js vjs-big-play-centered vjs-theme-atp"
                    playsInline
                />
            </div>

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
        
        @media (max-width: 768px) {
          .video-player.portrait {
            max-width: 100%;
          }
        }
      `}</style>
        </div>
    );
}
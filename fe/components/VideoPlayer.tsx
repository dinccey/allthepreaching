/**
 * Video.js player component
 * Supports captions, speed control, quality selection, wake lock
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import videojs from 'video.js';
import 'video.js/dist/video-js.css';

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
    const playerRef = useRef<any>(null);
    const [wakeLock, setWakeLock] = useState<any>(null);

    const trackList = useMemo(() => tracks || [], [tracks]);

    useEffect(() => {
        if (!videoRef.current) return;

        // Initialize Video.js
        const player = videojs(videoRef.current, {
            controls: true,
            responsive: true,
            fluid: true,
            playbackRates: [0.5, 0.75, 1, 1.25, 1.5, 2],
            controlBar: {
                children: [
                    'playToggle',
                    'volumePanel',
                    'currentTimeDisplay',
                    'timeDivider',
                    'durationDisplay',
                    'progressControl',
                    'playbackRateMenuButton',
                    'pictureInPictureToggle',
                    'fullscreenToggle',
                ],
            },
        });

        playerRef.current = player;

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

        return () => {
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

    return (
        <div className={`video-player ${portrait ? 'portrait' : ''}`}>
            <div data-vjs-player>
                <video
                    ref={videoRef}
                    className="video-js vjs-big-play-centered"
                    playsInline
                />
            </div>

            <style jsx>{`
        .video-player {
          width: 100%;
          max-width: 100%;
        }
        
        .video-player.portrait {
          max-width: 600px;
          margin: 0 auto;
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

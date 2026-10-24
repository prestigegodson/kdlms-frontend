import { useEffect, useRef } from "react";
import { usePauseWhenHidden } from "@/hooks/usePauseWhenHidden";

/**
 * The interactive video player drives either source - an uploaded mp4 in a native `<video>` or a
 * YouTube video through the IFrame API - through this one interface, with the native controls
 * of both turned off: the player draws its own control bar so a forward seek can be stopped at an
 * unanswered mandatory item, which neither native control set allows.
 */
export interface VideoController {
  play(): void;
  pause(): void;
  seek(seconds: number): void;
  currentTime(): number;
  setMuted(muted: boolean): void;
}

export interface VideoSourceEvents {
  onReady: (controller: VideoController) => void;
  /** Fires a few times a second while playing, and after every seek. */
  onTime: (seconds: number) => void;
  onPlayingChange: (playing: boolean) => void;
  onDuration: (seconds: number) => void;
  onEnded: () => void;
  onError: () => void;
}

/** Keeps the latest `events` reachable from long-lived listeners without re-subscribing them. */
function useLatest<T>(value: T) {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  });
  return ref;
}

/**
 * An uploaded mp4 streamed from its presigned URL. Like `ResourceViewer`'s `MediaPlayer`, an
 * expired URL is refreshed once through `onUrlExpired` and playback picks up where it was.
 */
export function HtmlVideoSource({
  url,
  title,
  onUrlExpired,
  events,
}: {
  url: string;
  title: string;
  onUrlExpired?: () => void;
  events: VideoSourceEvents;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const resumeRef = useRef<{ positionSeconds: number; playing: boolean } | null>(null);
  const retriedRef = useRef(false);
  const eventsRef = useLatest(events);

  usePauseWhenHidden(() => {
    const video = videoRef.current;
    if (video && !video.paused) {
      video.pause();
    }
  });

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    eventsRef.current.onReady({
      play: () => {
        video.play().catch(() => {});
      },
      pause: () => video.pause(),
      seek: (seconds) => {
        video.currentTime = seconds;
      },
      currentTime: () => video.currentTime,
      setMuted: (muted) => {
        video.muted = muted;
      },
    });
  }, [eventsRef]);

  function handleLoadedMetadata() {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    if (Number.isFinite(video.duration)) {
      eventsRef.current.onDuration(video.duration);
    }
    const resume = resumeRef.current;
    resumeRef.current = null;
    if (resume) {
      video.currentTime = resume.positionSeconds;
      if (resume.playing) {
        video.play().catch(() => {});
      }
    }
  }

  function handleError() {
    const video = videoRef.current;
    if (!onUrlExpired || retriedRef.current) {
      eventsRef.current.onError();
      return;
    }
    retriedRef.current = true;
    resumeRef.current = { positionSeconds: video?.currentTime ?? 0, playing: video ? !video.paused : false };
    onUrlExpired();
  }

  return (
    <video
      ref={videoRef}
      playsInline
      preload="metadata"
      className="absolute inset-0 h-full w-full bg-black"
      src={url}
      title={title}
      onLoadedMetadata={handleLoadedMetadata}
      onTimeUpdate={() => eventsRef.current.onTime(videoRef.current?.currentTime ?? 0)}
      onSeeked={() => eventsRef.current.onTime(videoRef.current?.currentTime ?? 0)}
      onPlay={() => eventsRef.current.onPlayingChange(true)}
      onPause={() => eventsRef.current.onPlayingChange(false)}
      onEnded={() => eventsRef.current.onEnded()}
      onError={handleError}
      onCanPlay={() => {
        retriedRef.current = false;
      }}
    >
      Your browser doesn't support video playback.
    </video>
  );
}

/* The slice of the YouTube IFrame API this player uses - there are no published typings in the project. */
interface YouTubePlayer {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  getDuration(): number;
  mute(): void;
  unMute(): void;
  destroy(): void;
}

interface YouTubeNamespace {
  Player: new (
    element: HTMLElement,
    options: {
      videoId: string;
      host?: string;
      playerVars?: Record<string, string | number>;
      events?: {
        onReady?: () => void;
        onStateChange?: (event: { data: number }) => void;
        onError?: () => void;
      };
    },
  ) => YouTubePlayer;
}

declare global {
  interface Window {
    YT?: YouTubeNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

const YT_STATE_ENDED = 0;
const YT_STATE_PLAYING = 1;
const YT_POLL_MS = 250;

let youTubeApi: Promise<YouTubeNamespace> | null = null;

/** Loads the IFrame API script once per page; every player after the first reuses it. */
function loadYouTubeApi(): Promise<YouTubeNamespace> {
  if (window.YT?.Player) {
    return Promise.resolve(window.YT);
  }
  if (!youTubeApi) {
    youTubeApi = new Promise((resolve, reject) => {
      const previous = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        previous?.();
        if (window.YT) {
          resolve(window.YT);
        }
      };
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      script.onerror = () => {
        youTubeApi = null;
        reject(new Error("The YouTube player couldn't load."));
      };
      document.head.appendChild(script);
    });
  }
  return youTubeApi;
}

/**
 * A YouTube video through the IFrame API on the privacy-enhanced host, with YouTube's own controls,
 * keyboard shortcuts and fullscreen button off (the player's control bar replaces them) and its
 * current time polled, since the API has no time-update event. A removed video or one whose owner
 * disabled embedding raises `onError`.
 */
export function YouTubeVideoSource({ videoId, events }: { videoId: string; events: VideoSourceEvents }) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const eventsRef = useLatest(events);
  const playerRef = useRef<YouTubePlayer | null>(null);

  usePauseWhenHidden(() => playerRef.current?.pauseVideo(), { onBlur: false });

  useEffect(() => {
    let cancelled = false;
    let poll: ReturnType<typeof setInterval> | null = null;
    const mount = document.createElement("div");
    hostRef.current?.appendChild(mount);

    function stopPolling() {
      if (poll !== null) {
        clearInterval(poll);
        poll = null;
      }
    }

    loadYouTubeApi()
      .then((YT) => {
        if (cancelled) {
          return;
        }
        const player = new YT.Player(mount, {
          videoId,
          host: "https://www.youtube-nocookie.com",
          playerVars: {
            controls: 0,
            disablekb: 1,
            fs: 0,
            rel: 0,
            playsinline: 1,
            iv_load_policy: 3,
            modestbranding: 1,
            origin: window.location.origin,
          },
          events: {
            onReady: () => {
              if (cancelled) {
                return;
              }
              playerRef.current = player;
              const duration = player.getDuration();
              if (duration > 0) {
                eventsRef.current.onDuration(duration);
              }
              eventsRef.current.onReady({
                play: () => player.playVideo(),
                pause: () => player.pauseVideo(),
                seek: (seconds) => {
                  player.seekTo(seconds, true);
                  eventsRef.current.onTime(seconds);
                },
                currentTime: () => player.getCurrentTime(),
                setMuted: (muted) => (muted ? player.mute() : player.unMute()),
              });
            },
            onStateChange: ({ data }) => {
              if (data === YT_STATE_PLAYING) {
                const duration = player.getDuration();
                if (duration > 0) {
                  eventsRef.current.onDuration(duration);
                }
                eventsRef.current.onPlayingChange(true);
                stopPolling();
                poll = setInterval(() => eventsRef.current.onTime(player.getCurrentTime()), YT_POLL_MS);
              } else {
                stopPolling();
                eventsRef.current.onPlayingChange(false);
                eventsRef.current.onTime(player.getCurrentTime());
                if (data === YT_STATE_ENDED) {
                  eventsRef.current.onEnded();
                }
              }
            },
            onError: () => eventsRef.current.onError(),
          },
        });
      })
      .catch(() => {
        if (!cancelled) {
          eventsRef.current.onError();
        }
      });

    return () => {
      cancelled = true;
      stopPolling();
      playerRef.current?.destroy();
      playerRef.current = null;
      mount.remove();
    };
  }, [videoId, eventsRef]);

  // The API replaces `mount` with its iframe; the wrapper sizes it to the stage.
  return <div ref={hostRef} className="absolute inset-0 bg-black [&_iframe]:h-full [&_iframe]:w-full" />;
}

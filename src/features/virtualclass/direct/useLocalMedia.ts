import { useCallback, useEffect, useRef, useState } from "react";

/**
 * The pre-join device check for a one-on-one call (webrtc-video.md §6.3): asks for the camera and
 * microphone, lists the devices to pick from, and says what went wrong in terms the page can explain.
 * Holds the one local `MediaStream` the call then sends, and stops it on unmount or `release()`.
 */

/**
 * `unsupported`: no `navigator.mediaDevices` at all - an in-app browser (WhatsApp, Instagram) or
 * WKWebView before iOS 14.3, or a page served over plain http. `no-camera`: joining with the
 * microphone only. `no-device`: neither works, so only a listen-only join is left.
 */
export type MediaProblem =
  "unsupported" | "denied" | "no-camera" | "no-device" | "in-use" | "other";

export function mediaSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices &&
    !!navigator.mediaDevices.getUserMedia
  );
}

export function classifyMediaError(
  error: unknown,
): Exclude<MediaProblem, "unsupported" | "no-camera"> {
  const name = error && typeof error === "object" && "name" in error ? String(error.name) : "";
  switch (name) {
    case "NotAllowedError":
    case "PermissionDeniedError": // Chrome < 64's name for it
    case "SecurityError":
      return "denied";
    case "NotFoundError":
    case "DevicesNotFoundError":
    case "OverconstrainedError":
      return "no-device";
    case "NotReadableError":
    case "TrackStartError":
    case "AbortError":
      return "in-use";
    default:
      return "other";
  }
}

export interface LocalMedia {
  stream: MediaStream | null;
  /** True while a `getUserMedia` request is outstanding. */
  pending: boolean;
  problem: MediaProblem | null;
  audioInputs: MediaDeviceInfo[];
  videoInputs: MediaDeviceInfo[];
  audioDeviceId: string;
  videoDeviceId: string;
  selectAudio: (deviceId: string) => void;
  selectVideo: (deviceId: string) => void;
  /** Asks again (after the viewer has unblocked the camera, say). */
  retry: () => void;
  /** Stops every local track - the call is over. */
  release: () => void;
}

function stop(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

function constraint(deviceId: string): MediaTrackConstraints | boolean {
  return deviceId ? { deviceId: { exact: deviceId } } : true;
}

/** `enabled` false (a guardian, or no media support) asks for nothing. */
export function useLocalMedia(enabled: boolean): LocalMedia {
  const supported = mediaSupported();
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [pending, setPending] = useState(enabled && supported);
  const [problem, setProblem] = useState<MediaProblem | null>(supported ? null : "unsupported");
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioDeviceId, setAudioDeviceId] = useState("");
  const [videoDeviceId, setVideoDeviceId] = useState("");
  const [attempt, setAttempt] = useState(0);
  const streamRef = useRef<MediaStream | null>(null);

  const listDevices = useCallback(() => {
    if (!mediaSupported() || !navigator.mediaDevices.enumerateDevices) return;
    navigator.mediaDevices
      .enumerateDevices()
      .then(setDevices)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!enabled || !supported) return;
    let current = true;
    const media = navigator.mediaDevices;
    const take = (next: MediaStream, found: MediaProblem | null) => {
      if (!current) {
        stop(next);
        return;
      }
      stop(streamRef.current);
      streamRef.current = next;
      setStream(next);
      setProblem(found);
      setPending(false);
      listDevices();
    };
    const fail = (found: MediaProblem) => {
      if (!current) return;
      stop(streamRef.current);
      streamRef.current = null;
      setStream(null);
      setProblem(found);
      setPending(false);
      listDevices();
    };
    media
      .getUserMedia({ audio: constraint(audioDeviceId), video: constraint(videoDeviceId) })
      .then((next) => take(next, null))
      .catch((error: unknown) => {
        const found = classifyMediaError(error);
        if (found !== "no-device" && found !== "in-use") {
          fail(found);
          return;
        }
        // No camera (or it's busy): fall back to the microphone alone.
        media
          .getUserMedia({ audio: constraint(audioDeviceId) })
          .then((next) => take(next, found === "in-use" ? "in-use" : "no-camera"))
          .catch((audioError: unknown) => {
            const audioProblem = classifyMediaError(audioError);
            fail(audioProblem === "no-device" && found === "in-use" ? "in-use" : audioProblem);
          });
      });
    return () => {
      current = false;
    };
  }, [enabled, supported, audioDeviceId, videoDeviceId, attempt, listDevices]);

  useEffect(() => {
    if (!enabled || !supported) return;
    const media = navigator.mediaDevices;
    if (typeof media.addEventListener !== "function") return;
    media.addEventListener("devicechange", listDevices);
    return () => media.removeEventListener("devicechange", listDevices);
  }, [enabled, supported, listDevices]);

  useEffect(
    () => () => {
      stop(streamRef.current);
      streamRef.current = null;
    },
    [],
  );

  const release = useCallback(() => {
    stop(streamRef.current);
    streamRef.current = null;
    setStream(null);
  }, []);

  const request = (apply: () => void) => {
    setPending(true);
    apply();
  };

  return {
    stream,
    pending,
    problem,
    audioInputs: devices.filter((device) => device.kind === "audioinput"),
    videoInputs: devices.filter((device) => device.kind === "videoinput"),
    audioDeviceId,
    videoDeviceId,
    selectAudio: (deviceId) => request(() => setAudioDeviceId(deviceId)),
    selectVideo: (deviceId) => request(() => setVideoDeviceId(deviceId)),
    retry: () => request(() => setAttempt((count) => count + 1)),
    release,
  };
}

/**
 * The microphone's level, 0-1, for the pre-join meter. An `AudioContext` made before a user gesture
 * starts suspended (always on iOS), so `resume()` is wired to the first click on the page.
 */
export function useMicLevel(stream: MediaStream | null): { level: number; resume: () => void } {
  const [level, setLevel] = useState(0);
  const contextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    const AudioContextClass =
      typeof window !== "undefined"
        ? (window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)
        : undefined;
    if (!stream || stream.getAudioTracks().length === 0 || !AudioContextClass) return;
    let context: AudioContext;
    try {
      context = new AudioContextClass();
    } catch {
      return;
    }
    contextRef.current = context;
    const source = context.createMediaStreamSource(stream);
    const analyser = context.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    const samples = new Uint8Array(analyser.fftSize);
    let frame = 0;
    const tick = () => {
      analyser.getByteTimeDomainData(samples);
      let peak = 0;
      for (let i = 0; i < samples.length; i++) {
        peak = Math.max(peak, Math.abs(samples[i] - 128));
      }
      setLevel(Math.min(1, peak / 64));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      source.disconnect();
      contextRef.current = null;
      void context.close().catch(() => undefined);
    };
  }, [stream]);

  const resume = useCallback(() => {
    const context = contextRef.current;
    if (context && context.state === "suspended") void context.resume().catch(() => undefined);
  }, []);

  return { level, resume };
}

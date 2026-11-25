// adapter.js smooths over Plan B / Unified Plan and old `getStats` shapes (webrtc-video.md §6.1).
// Imported here only, so it ships in this lazily loaded chunk and nowhere else.
import "webrtc-adapter";
import { ArrowLeft, Copy, Eye, Mic, MicOff, PhoneOff, Video, VideoOff } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import type { JoinView } from "@/api/liveSessions";
import { Alert } from "@/components/ui/Alert";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Select } from "@/components/ui/Select";
import { Spinner } from "@/components/ui/Spinner";
import { initialsOfFullName } from "@/utils/initials";
import type { CallState } from "./callController";
import { useDirectCall } from "./useDirectCall";
import { type LocalMedia, mediaSupported, useLocalMedia, useMicLevel } from "./useLocalMedia";

interface DirectCallPageProps {
  /** The route's `POST …/join` answer for a DIRECT session. */
  session: JoinView;
  home: string;
}

/**
 * A one-on-one video lesson (webrtc-video.md Phase V5): peer-to-peer WebRTC between the tutor and
 * one learner, or a guardian watching on the learner's side. The creator or learner first checks
 * their camera and microphone; pressing "Join call" is also the user gesture iOS needs before it
 * plays remote audio. A guardian watches without a device check, sending nothing.
 */
export function DirectCallPage({ session, home }: DirectCallPageProps) {
  const guardian = session.role === "GUARDIAN";
  const supported = mediaSupported();
  const media = useLocalMedia(!guardian && supported);
  const [stage, setStage] = useState<"prejoin" | "call">("prejoin");
  const [callSession, setCallSession] = useState(session);
  const [callCount, setCallCount] = useState(0);

  if (!guardian && !supported) {
    return <OpenInBrowser home={home} className={session.className} />;
  }

  if (stage === "call") {
    return (
      <CallView
        key={callCount}
        session={callSession}
        stream={guardian ? null : media.stream}
        home={home}
        onFinished={media.release}
        onRejoin={() => {
          // The first ticket is spent; the call fetches a fresh one when it starts.
          setCallSession({ ...session, ticket: null, ticketExpiresAt: null });
          setCallCount((count) => count + 1);
          setStage("prejoin");
          media.retry();
        }}
      />
    );
  }

  return (
    <PageFrame home={home}>
      <h1 className="font-display text-xl font-semibold text-slate-900">{session.className}</h1>
      <p className="text-sm text-slate-600">
        One-on-one video lesson{session.peerName ? ` with ${session.peerName}` : ""}.
      </p>
      {guardian ? (
        <Card>
          <p className="text-sm text-slate-700">
            You'll watch this lesson: you can see and hear the tutor, but your camera and microphone
            stay off.
          </p>
          <Button type="button" className="mt-4" onClick={() => setStage("call")}>
            <Eye className="h-4 w-4" aria-hidden="true" /> Watch lesson
          </Button>
        </Card>
      ) : (
        <DeviceCheck media={media} onJoin={() => setStage("call")} />
      )}
    </PageFrame>
  );
}

function PageFrame({ home, children }: { home: string; children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-slate-50 px-4 py-6">
      <div className="mx-auto flex max-w-2xl flex-col gap-4">
        <Link
          to={home}
          className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back
        </Link>
        {children}
      </div>
    </div>
  );
}

/** No `navigator.mediaDevices`: an in-app browser or an old WebView, which can't do video calls (§6.2). */
function OpenInBrowser({ home, className }: { home: string; className: string }) {
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const link = window.location.href;
  const copy = () => {
    const fallback = () => {
      inputRef.current?.select();
      try {
        setCopied(document.execCommand("copy"));
      } catch {
        setCopied(false);
      }
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(link).then(() => setCopied(true), fallback);
    } else {
      fallback();
    }
  };
  return (
    <PageFrame home={home}>
      <h1 className="font-display text-xl font-semibold text-slate-900">{className}</h1>
      <Alert variant="warning" title="Open this link in Safari or Chrome">
        This browser can't use your camera and microphone - often because the link was opened inside
        another app. Copy the link and open it in Safari on an iPhone or iPad, or in Chrome on other
        devices.
      </Alert>
      <div className="flex gap-2">
        <input
          ref={inputRef}
          readOnly
          value={link}
          aria-label="Lesson link"
          className="min-w-0 flex-1 rounded-control border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
          onFocus={(event) => event.currentTarget.select()}
        />
        <Button type="button" variant="secondary" onClick={copy}>
          <Copy className="h-4 w-4" aria-hidden="true" /> {copied ? "Copied" : "Copy link"}
        </Button>
      </div>
    </PageFrame>
  );
}

const PROBLEM_COPY: Record<string, { title: string; body: string; variant: "warning" | "error" }> =
  {
    denied: {
      title: "Camera and microphone are blocked",
      body:
        "Allow camera and microphone access for this site - tap the camera or lock icon next to the address, " +
        "or on an iPhone go to Settings › Safari › Camera and Microphone - then try again.",
      variant: "error",
    },
    "no-camera": {
      title: "No camera found",
      body: "You can still join with your microphone only.",
      variant: "warning",
    },
    "no-device": {
      title: "No camera or microphone found",
      body: "You can still join to watch and listen.",
      variant: "warning",
    },
    "in-use": {
      title: "Your camera is being used by another app",
      body: "Close the other app (a video call, the camera app) and try again, or join without it.",
      variant: "warning",
    },
    other: {
      title: "We couldn't start your camera and microphone",
      body: "Try again, or join to watch and listen.",
      variant: "warning",
    },
  };

function DeviceCheck({ media, onJoin }: { media: LocalMedia; onJoin: () => void }) {
  const { level, resume } = useMicLevel(media.stream);
  const hasVideo = (media.stream?.getVideoTracks().length ?? 0) > 0;
  const hasAudio = (media.stream?.getAudioTracks().length ?? 0) > 0;
  const copy = media.problem ? PROBLEM_COPY[media.problem] : null;
  const joinLabel = hasAudio || hasVideo ? "Join call" : "Join to listen only";
  return (
    <Card>
      <div className="flex flex-col gap-4" onPointerDown={resume}>
        <p className="text-sm text-slate-600">Check your camera and microphone, then join.</p>
        <div className="relative aspect-video overflow-hidden rounded-card bg-slate-900">
          {hasVideo ? (
            <StreamVideo
              stream={media.stream}
              muted
              mirror
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-slate-300">
              {media.pending ? (
                <Spinner />
              ) : (
                <VideoOff className="h-8 w-8" aria-label="Camera off" />
              )}
            </div>
          )}
        </div>
        {copy && (
          <Alert variant={copy.variant} title={copy.title}>
            {copy.body}
          </Alert>
        )}
        {media.stream && (
          <div className="grid gap-3 sm:grid-cols-2">
            {media.audioInputs.length > 0 && (
              <label className="flex flex-col gap-1 text-sm text-slate-700">
                Microphone
                <Select
                  value={media.audioDeviceId}
                  onChange={(event) => media.selectAudio(event.target.value)}
                  disabled={media.pending}
                >
                  <option value="">Default microphone</option>
                  {media.audioInputs.map((device, index) => (
                    <option key={device.deviceId || index} value={device.deviceId}>
                      {device.label || `Microphone ${index + 1}`}
                    </option>
                  ))}
                </Select>
              </label>
            )}
            {media.videoInputs.length > 0 && (
              <label className="flex flex-col gap-1 text-sm text-slate-700">
                Camera
                <Select
                  value={media.videoDeviceId}
                  onChange={(event) => media.selectVideo(event.target.value)}
                  disabled={media.pending}
                >
                  <option value="">Default camera</option>
                  {media.videoInputs.map((device, index) => (
                    <option key={device.deviceId || index} value={device.deviceId}>
                      {device.label || `Camera ${index + 1}`}
                    </option>
                  ))}
                </Select>
              </label>
            )}
          </div>
        )}
        {hasAudio && (
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Mic className="h-4 w-4" aria-hidden="true" />
            <div
              className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200"
              role="meter"
              aria-label="Microphone level"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(level * 100)}
            >
              <div
                className="h-full bg-green-500 transition-all"
                style={{ width: `${Math.round(level * 100)}%` }}
              />
            </div>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Button type="button" disabled={media.pending} onClick={onJoin}>
            <Video className="h-4 w-4" aria-hidden="true" /> {joinLabel}
          </Button>
          {media.problem && media.problem !== "no-camera" && (
            <Button
              type="button"
              variant="secondary"
              disabled={media.pending}
              onClick={media.retry}
            >
              Try again
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

/** A `<video>` showing a `MediaStream`. `playsInline` + `autoPlay` (+ `muted` for our own preview) for iOS (§6.2). */
function StreamVideo({
  stream,
  muted = false,
  mirror = false,
  version = 0,
  className = "",
  label,
}: {
  stream: MediaStream | null;
  muted?: boolean;
  mirror?: boolean;
  version?: number;
  className?: string;
  label?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.muted = muted;
    if (element.srcObject !== stream) element.srcObject = stream;
    if (stream && typeof element.play === "function") {
      const playing = element.play() as Promise<void> | undefined;
      if (playing && typeof playing.catch === "function") playing.catch(() => undefined);
    }
  }, [stream, muted, version]);
  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted={muted}
      aria-label={label}
      className={`${mirror ? "-scale-x-100" : ""} ${className}`}
    />
  );
}

const ENDED_COPY: Record<string, (creator: boolean) => string> = {
  "creator-ended": (creator) => (creator ? "You ended the lesson." : "The tutor ended the lesson."),
  "window-closed": () => "The lesson's time is up.",
  cancelled: () => "This session was cancelled.",
  left: () => "You left the call.",
  unavailable: () => "This lesson can no longer be joined.",
};

const REFUSAL_COPY: Record<string, string> = {
  replaced: "You joined this call from another tab or device, so it continues there.",
  full: "This call already has two people in it.",
  refused: "This session can't be joined right now.",
};

function CallView({
  session,
  stream,
  home,
  onFinished,
  onRejoin,
}: {
  session: JoinView;
  stream: MediaStream | null;
  home: string;
  onFinished: () => void;
  onRejoin: () => void;
}) {
  const { state, toggleAudio, toggleVideo, hangup } = useDirectCall(session, stream);
  const creator = session.role === "CREATOR";
  const guardian = session.role === "GUARDIAN";
  const [confirmingEnd, setConfirmingEnd] = useState(false);
  const over = state.phase === "ended" || state.phase === "refused";

  useEffect(() => {
    if (over) onFinished();
  }, [over, onFinished]);

  if (over) {
    const message =
      state.phase === "refused"
        ? REFUSAL_COPY[state.refusal ?? "refused"]
        : ENDED_COPY[state.endedReason ?? "creator-ended"](creator);
    const canRejoin = state.endedReason === "left" || state.refusal === "replaced";
    return (
      <PageFrame home={home}>
        <h1 className="font-display text-xl font-semibold text-slate-900">{session.className}</h1>
        <Card>
          <p className="text-sm text-slate-700">{message}</p>
          {canRejoin && (
            <Button type="button" className="mt-4" onClick={onRejoin}>
              Rejoin
            </Button>
          )}
        </Card>
      </PageFrame>
    );
  }

  const peerLabel = state.peerName ?? (creator ? "your learner" : "your tutor");
  const peerVideoShown =
    state.remoteStream !== null &&
    state.peerMedia.video &&
    state.remoteStream.getVideoTracks().length > 0;
  const hasLocalVideo = (stream?.getVideoTracks().length ?? 0) > 0;
  const hasLocalAudio = (stream?.getAudioTracks().length ?? 0) > 0;

  return (
    <div className="flex flex-col bg-slate-900 text-white" style={{ height: "100dvh" }}>
      <header className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
        <span className="truncate font-medium">{session.className}</span>
        <div className="flex shrink-0 items-center gap-2">
          {guardian && (
            <span className="inline-flex items-center gap-1 text-slate-300">
              <Eye className="h-4 w-4" aria-hidden="true" /> Watching
            </span>
          )}
          {state.phase === "in-call" && <ConnectionBadge state={state} />}
        </div>
      </header>
      {state.endingMinutes !== null && (
        <div className="px-4 pb-2">
          <Alert variant="warning">
            This lesson's time is almost up - about {state.endingMinutes}{" "}
            {state.endingMinutes === 1 ? "minute" : "minutes"} left.
          </Alert>
        </div>
      )}
      <main className="relative min-h-0 flex-1 overflow-hidden">
        {state.remoteStream && (
          <StreamVideo
            stream={state.remoteStream}
            label={`${peerLabel}'s video`}
            className={`h-full w-full object-contain ${peerVideoShown ? "" : "invisible"}`}
          />
        )}
        {!peerVideoShown && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
            {state.phase === "in-call" ? (
              <>
                <Avatar initials={initialsOfFullName(peerLabel)} url={null} size="xl" />
                <p className="text-sm text-slate-300">
                  {state.remoteStream
                    ? `${peerLabel}'s camera is off`
                    : `Connecting to ${peerLabel}…`}
                </p>
              </>
            ) : (
              <>
                <Spinner />
                <p className="text-sm text-slate-300">
                  {state.phase === "waiting" ? `Waiting for ${peerLabel} to join…` : "Connecting…"}
                </p>
              </>
            )}
          </div>
        )}
        {state.phase === "in-call" && state.remoteStream && !state.peerMedia.audio && (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-slate-800/80 px-2 py-1 text-xs">
            <MicOff className="h-3.5 w-3.5" aria-hidden="true" /> {peerLabel} is muted
          </span>
        )}
        {hasLocalVideo && (
          <div className="absolute bottom-3 right-3 w-28 overflow-hidden rounded-card border border-slate-700 bg-slate-800 shadow-lg sm:w-44">
            <StreamVideo
              stream={stream}
              muted
              mirror
              version={state.localVersion}
              label="Your video"
              className={`aspect-video w-full object-cover ${state.localVideo ? "" : "invisible"}`}
            />
          </div>
        )}
      </main>
      <footer className="flex items-center justify-center gap-3 px-4 py-3">
        {!guardian && (
          <>
            <ControlButton
              label={state.localAudio ? "Mute microphone" : "Unmute microphone"}
              active={state.localAudio}
              disabled={!hasLocalAudio}
              onClick={toggleAudio}
            >
              {state.localAudio ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
            </ControlButton>
            <ControlButton
              label={state.localVideo ? "Turn camera off" : "Turn camera on"}
              active={state.localVideo}
              disabled={!hasLocalVideo}
              onClick={toggleVideo}
            >
              {state.localVideo ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
            </ControlButton>
          </>
        )}
        <Button
          type="button"
          variant="danger"
          className="min-h-11 rounded-full"
          onClick={() => (creator ? setConfirmingEnd(true) : hangup())}
        >
          <PhoneOff className="h-5 w-5" aria-hidden="true" /> {creator ? "End lesson" : "Leave"}
        </Button>
      </footer>
      {confirmingEnd && (
        <ConfirmDialog
          title="End the lesson for both of you?"
          message={`${peerLabel} will be disconnected, and the lesson can't be rejoined.`}
          confirmLabel="End lesson"
          variant="danger"
          onConfirm={async () => hangup()}
          onClose={() => setConfirmingEnd(false)}
        />
      )}
    </div>
  );
}

function ControlButton({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={!active}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={`flex h-11 w-11 items-center justify-center rounded-full transition-colors disabled:opacity-40 ${
        active
          ? "bg-slate-700 text-white hover:bg-slate-600"
          : "bg-white text-slate-900 hover:bg-slate-200"
      }`}
    >
      {children}
    </button>
  );
}

function ConnectionBadge({ state }: { state: CallState }) {
  if (state.reconnecting) return <Badge variant="warning">Reconnecting…</Badge>;
  switch (state.connection) {
    case "direct":
      return <Badge variant="success">Direct</Badge>;
    case "relay":
      return <Badge variant="info">Relayed</Badge>;
    case "poor":
      return <Badge variant="warning">Poor connection</Badge>;
    case "failed":
      return <Badge variant="danger">Connection lost</Badge>;
    default:
      return <Badge variant="neutral">Connecting…</Badge>;
  }
}

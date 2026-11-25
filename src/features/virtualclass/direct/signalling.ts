import type { ParticipantRole } from "@/api/liveSessions";

/**
 * One-on-one video's signalling socket (webrtc-video.md §4) - the client side of the backend's
 * `SignallingHub`. Every frame is a JSON object with a `type`; the socket proves who it is with the
 * join's single-use ticket in its first `hello` frame, never in the URL. The server pings every
 * admitted socket and drops one that leaves three pings unanswered, so this client answers `ping`
 * itself. Reconnecting needs a fresh ticket from `POST …/join`, so that policy lives in
 * `useDirectCall`, not here.
 */

export type EndedReason = "creator-ended" | "window-closed" | "cancelled";

/** What the server sends. `offer`/`answer`/`ice`/`media-state` are the other peer's frames, relayed. */
export type SignalIn =
  | { type: "welcome"; role: ParticipantRole; peerPresent: boolean; expiresAt: string }
  | { type: "peer-joined"; role: ParticipantRole; name: string | null }
  | { type: "peer-left"; reason: string }
  | { type: "offer"; sdp: string }
  | { type: "answer"; sdp: string }
  | { type: "ice"; candidate: string | null; sdpMid: string | null; sdpMLineIndex: number | null }
  | { type: "media-state"; audio: boolean; video: boolean }
  | { type: "session-ending"; minutesLeft: number }
  | { type: "ended"; reason: EndedReason | string }
  | { type: "error"; code: string }
  | { type: "ping" }
  | { type: "pong" };

/** What a client may send. */
export type SignalOut =
  | { type: "hello"; ticket: string }
  | { type: "offer"; sdp: string }
  | { type: "answer"; sdp: string }
  | { type: "ice"; candidate: string | null; sdpMid: string | null; sdpMLineIndex: number | null }
  | { type: "media-state"; audio: boolean; video: boolean }
  | { type: "hangup" }
  | { type: "ping" }
  | { type: "pong" };

const isString = (value: unknown): value is string => typeof value === "string";
const isBoolean = (value: unknown): value is boolean => typeof value === "boolean";
const isNumber = (value: unknown): value is number => typeof value === "number" && isFinite(value);
const stringOrNull = (value: unknown): string | null => (isString(value) ? value : null);

/** A server frame, or `null` for anything malformed or outside the closed set. */
export function parseSignal(text: string): SignalIn | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (raw === null || typeof raw !== "object") return null;
  const frame = raw as Record<string, unknown>;
  switch (frame.type) {
    case "welcome":
      return isString(frame.role) && isBoolean(frame.peerPresent)
        ? {
            type: "welcome",
            role: frame.role as ParticipantRole,
            peerPresent: frame.peerPresent,
            expiresAt: stringOrNull(frame.expiresAt) ?? "",
          }
        : null;
    case "peer-joined":
      return isString(frame.role)
        ? {
            type: "peer-joined",
            role: frame.role as ParticipantRole,
            name: stringOrNull(frame.name),
          }
        : null;
    case "peer-left":
      return { type: "peer-left", reason: stringOrNull(frame.reason) ?? "left" };
    case "offer":
    case "answer":
      return isString(frame.sdp) ? { type: frame.type, sdp: frame.sdp } : null;
    case "ice":
      return {
        type: "ice",
        candidate: stringOrNull(frame.candidate),
        sdpMid: stringOrNull(frame.sdpMid),
        sdpMLineIndex: isNumber(frame.sdpMLineIndex) ? frame.sdpMLineIndex : null,
      };
    case "media-state":
      return isBoolean(frame.audio) && isBoolean(frame.video)
        ? { type: "media-state", audio: frame.audio, video: frame.video }
        : null;
    case "session-ending":
      return isNumber(frame.minutesLeft)
        ? { type: "session-ending", minutesLeft: frame.minutesLeft }
        : null;
    case "ended":
      return { type: "ended", reason: stringOrNull(frame.reason) ?? "creator-ended" };
    case "error":
      return isString(frame.code) ? { type: "error", code: frame.code } : null;
    case "ping":
    case "pong":
      return { type: frame.type };
    default:
      return null;
  }
}

/** Close codes the hub uses (webrtc-video.md §4.3). */
export const CLOSE_ENDED = 4000;
export const CLOSE_BAD_TICKET = 4401;
export const CLOSE_NOT_ALLOWED = 4403;
export const CLOSE_ROOM_FULL = 4409;
export const CLOSE_REPLACED = 4410;

/**
 * What a socket close means to the call: `ended` is final, `replaced`/`full`/`refused` are a refusal
 * that reconnecting won't fix, and `dropped` (a network blip, a server restart, a missed ping) is
 * worth a reconnect with a fresh ticket.
 */
export type CloseKind = "ended" | "replaced" | "full" | "refused" | "dropped";

export function closeKind(code: number): CloseKind {
  switch (code) {
    case CLOSE_ENDED:
      return "ended";
    case CLOSE_REPLACED:
      return "replaced";
    case CLOSE_ROOM_FULL:
      return "full";
    case CLOSE_BAD_TICKET:
    case CLOSE_NOT_ALLOWED:
      return "refused";
    default:
      return "dropped";
  }
}

/** The absolute `ws(s)://` URL for the join's same-origin `signallingUrl` (e.g. `/ws/rtc`). */
export function socketUrl(
  path: string,
  location: Pick<Location, "protocol" | "host"> = window.location,
): string {
  if (/^wss?:\/\//.test(path)) return path;
  const scheme = location.protocol === "https:" ? "wss:" : "ws:";
  return `${scheme}//${location.host}${path.charAt(0) === "/" ? path : `/${path}`}`;
}

export interface SignallingHandlers {
  onMessage: (message: SignalIn) => void;
  onClose: (code: number) => void;
}

export type WebSocketFactory = new (url: string) => WebSocket;

export class SignallingClient {
  private socket: WebSocket | null = null;
  private closedByUs = false;
  private readonly url: string;
  private readonly ticket: string;
  private readonly handlers: SignallingHandlers;
  private readonly Socket: WebSocketFactory;

  constructor(
    url: string,
    ticket: string,
    handlers: SignallingHandlers,
    Socket?: WebSocketFactory,
  ) {
    this.url = url;
    this.ticket = ticket;
    this.handlers = handlers;
    this.Socket = Socket ?? WebSocket;
  }

  connect(): void {
    const socket = new this.Socket(this.url);
    this.socket = socket;
    socket.onopen = () => this.send({ type: "hello", ticket: this.ticket });
    socket.onmessage = (event: MessageEvent) => {
      if (typeof event.data !== "string") return;
      const message = parseSignal(event.data);
      if (message === null) return;
      if (message.type === "ping") {
        this.send({ type: "pong" });
        return;
      }
      if (message.type === "pong") return;
      this.handlers.onMessage(message);
    };
    socket.onclose = (event: CloseEvent) => {
      this.socket = null;
      if (!this.closedByUs) this.handlers.onClose(event.code);
    };
  }

  send(message: SignalOut): void {
    if (this.socket && this.socket.readyState === 1 /* OPEN */) {
      this.socket.send(JSON.stringify(message));
    }
  }

  /** Closes the socket without telling `onClose` - the caller already knows why. */
  close(): void {
    this.closedByUs = true;
    const socket = this.socket;
    this.socket = null;
    if (socket && socket.readyState < 2 /* CLOSING */) {
      socket.close(1000);
    }
  }
}

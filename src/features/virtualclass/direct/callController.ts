import { ApiError } from "@/api/client";
import {
  type CallConnectionType,
  type IceServer,
  joinLiveSession,
  type JoinView,
  type ParticipantRole,
  reportCallConnection,
} from "@/api/liveSessions";
import {
  CLOSE_BAD_TICKET,
  closeKind,
  type SignalIn,
  SignallingClient,
  socketUrl,
  type WebSocketFactory,
} from "./signalling";

/**
 * One one-on-one call (webrtc-video.md §4.4): the signalling socket plus one `RTCPeerConnection`,
 * as a plain class so it can be driven and tested without React (`useDirectCall` wraps it).
 *
 * Negotiation roles are fixed, because "perfect negotiation" needs SDP rollback and an argument-less
 * `setLocalDescription()`, neither of which Chrome 64 / iOS 12 have: the **creator always offers**
 * and the learner or guardian only answers, so glare can't happen. A guardian adds no tracks, so its
 * answer is receive-only.
 *
 * Whenever the other side (re)joins the room, both sides start over with a fresh peer connection:
 * the creator on `peer-joined` (or its own `welcome` with the peer already there), the answerer on
 * its own `welcome` and on `peer-joined`. A peer that comes back may be a new tab with a new DTLS
 * identity, which an existing connection can't renegotiate to. While the other side's socket is
 * merely gone (`peer-left{disconnected}`), or ours is, the existing connection is left alone, so
 * media already flowing peer-to-peer keeps flowing through the gap.
 *
 * Only API that exists on the browser floor is used (§6.1): `addTrack`, `createOffer({iceRestart})`
 * for an ICE restart, `setLocalDescription(desc)` with an explicit description, and `replaceTrack`
 * only when it exists.
 */

export type CallPhase = "connecting" | "waiting" | "in-call" | "ended" | "refused";
export type ConnectionQuality = "connecting" | "direct" | "relay" | "poor" | "failed";
/** `creator-ended`/`window-closed`/`cancelled` come from the server; `left` is this side hanging up; `unavailable` a rejoin the API refused. */
export type CallEndReason =
  "creator-ended" | "window-closed" | "cancelled" | "left" | "unavailable";
export type RefusalReason = "replaced" | "full" | "refused";

export interface CallState {
  phase: CallPhase;
  /** The signalling socket is down and being reconnected; media may still be flowing. */
  reconnecting: boolean;
  connection: ConnectionQuality;
  remoteStream: MediaStream | null;
  peerName: string | null;
  peerRole: ParticipantRole | null;
  /** `screen`: the other side is sending a screen share rather than their camera. */
  peerMedia: { audio: boolean; video: boolean; screen: boolean };
  localAudio: boolean;
  /** The camera is on and being sent. Always false while this side shares its screen. */
  localVideo: boolean;
  /** This side (only ever the creator) is sharing its screen in place of its camera. */
  screenSharing: boolean;
  /** The screen being shared, for the self-view; null when not sharing. */
  screenStream: MediaStream | null;
  /** Bumped when the local stream's tracks change (a camera switch), so previews re-render. */
  localVersion: number;
  endedReason: CallEndReason | null;
  refusal: RefusalReason | null;
  endingMinutes: number | null;
}

export interface CallDeps {
  RTCPeerConnection: typeof RTCPeerConnection;
  WebSocket: WebSocketFactory;
  MediaStream: typeof MediaStream;
  join: (occurrenceId: string) => Promise<JoinView>;
  getUserMedia: (constraints: MediaStreamConstraints) => Promise<MediaStream>;
  /** Missing where the browser can't share a screen (iOS, Android, Chrome < 72). */
  getDisplayMedia: ((constraints: MediaStreamConstraints) => Promise<MediaStream>) | null;
  location: Pick<Location, "protocol" | "host">;
  /** `addEventListener` target for `online` - reconnect straight away when the network returns. */
  events: Pick<Window, "addEventListener" | "removeEventListener"> | null;
  /** The connection beacon (V6): once per peer connection, best effort. */
  reportConnection: (occurrenceId: string, connection: CallConnectionType) => Promise<void>;
}

/**
 * After ICE fails, how long the call gets to recover (the creator's ICE restart) before the peer
 * connection is reported as `failed`.
 */
export const FAILED_REPORT_MS = 15_000;

/** A ticket this close to expiry is swapped for a fresh one before connecting. */
const TICKET_MARGIN_MS = 10_000;
/** How long `iceConnectionState` may stay `disconnected` before the creator restarts ICE. */
export const DISCONNECTED_RESTART_MS = 5_000;
export const STATS_INTERVAL_MS = 3_000;
const MAX_BACKOFF_MS = 10_000;
/** Above these, the badge says "Poor connection". */
const POOR_LOSS = 0.05;
const POOR_RTT_SECONDS = 0.4;

export function toRtcIceServers(servers: IceServer[] | null): RTCIceServer[] {
  return (servers ?? []).map((server) => {
    const out: RTCIceServer = { urls: server.urls };
    if (server.username !== null) out.username = server.username;
    if (server.credential !== null) out.credential = server.credential;
    return out;
  });
}

export interface StatsSample {
  /** The selected candidate pair's path, or null when none is selected yet. */
  path: "direct" | "relay" | null;
  rttSeconds: number | null;
  packetsLost: number;
  packetsReceived: number;
}

type Stat = Record<string, unknown> & { id: string; type: string };

/**
 * Reads the selected candidate pair and inbound video counters from a `getStats()` report - the
 * standard shape, which Chrome 64+ and Safari 12+ return (adapter.js smooths over the rest).
 */
export function analyzeStats(report: RTCStatsReport): StatsSample {
  const byId = new Map<string, Stat>();
  report.forEach((stat: Stat) => byId.set(stat.id, stat));
  let pair: Stat | undefined;
  byId.forEach((stat) => {
    if (stat.type === "transport" && typeof stat.selectedCandidatePairId === "string") {
      pair = byId.get(stat.selectedCandidatePairId) ?? pair;
    }
  });
  if (!pair) {
    byId.forEach((stat) => {
      if (
        !pair &&
        stat.type === "candidate-pair" &&
        (stat.selected === true || (stat.nominated === true && stat.state === "succeeded"))
      ) {
        pair = stat;
      }
    });
  }
  let path: StatsSample["path"] = null;
  let rttSeconds: number | null = null;
  if (pair) {
    const local = byId.get(String(pair.localCandidateId));
    const remote = byId.get(String(pair.remoteCandidateId));
    path =
      local?.candidateType === "relay" || remote?.candidateType === "relay" ? "relay" : "direct";
    rttSeconds = typeof pair.currentRoundTripTime === "number" ? pair.currentRoundTripTime : null;
  }
  let packetsLost = 0;
  let packetsReceived = 0;
  byId.forEach((stat) => {
    const kind = stat.kind ?? stat.mediaType;
    if (stat.type === "inbound-rtp" && kind === "video") {
      packetsLost += typeof stat.packetsLost === "number" ? Math.max(0, stat.packetsLost) : 0;
      packetsReceived += typeof stat.packetsReceived === "number" ? stat.packetsReceived : 0;
    }
  });
  return { path, rttSeconds, packetsLost, packetsReceived };
}

/** Screen sharing needs `getDisplayMedia`: desktop Chrome 72+, Firefox 66+, Safari 13+ - never iOS or Android. */
export function screenShareSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getDisplayMedia === "function"
  );
}

function defaultDeps(): CallDeps {
  return {
    RTCPeerConnection: window.RTCPeerConnection,
    WebSocket: window.WebSocket,
    MediaStream: window.MediaStream,
    join: joinLiveSession,
    getUserMedia: (constraints) => navigator.mediaDevices.getUserMedia(constraints),
    getDisplayMedia: screenShareSupported()
      ? (constraints) => navigator.mediaDevices.getDisplayMedia(constraints)
      : null,
    location: window.location,
    events: window,
    reportConnection: reportCallConnection,
  };
}

type Listener = () => void;

export class DirectCallController {
  private state: CallState;
  private readonly listeners = new Set<Listener>();
  private readonly deps: CallDeps;
  private readonly session: JoinView;
  private readonly isCreator: boolean;
  private readonly publishes: boolean;
  private readonly localStream: MediaStream | null;

  private socket: SignallingClient | null = null;
  private pc: RTCPeerConnection | null = null;
  private pendingCandidates: RTCIceCandidateInit[] = [];
  /** An offer was wanted while another was still waiting for its answer. */
  private offerQueued = false;
  private peerPresent = false;
  private welcomed = false;
  private iceConnected = false;
  private reconnectAttempts = 0;
  private freshTicketTried = false;
  private disposed = false;
  private previousLoss = { lost: 0, received: 0 };
  /** This peer connection's beacon has gone out. */
  private connectionReported = false;
  /** The screen track being sent in the camera's place, while sharing. */
  private screenTrack: MediaStreamTrack | null = null;
  /** Whether the camera was on when sharing began, so stopping puts it back as it was. */
  private cameraWasOn = false;
  /** A `getDisplayMedia` picker is open. */
  private screenPending = false;

  private startTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private disconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private statsTimer: ReturnType<typeof setInterval> | null = null;
  private failedReportTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(session: JoinView, localStream: MediaStream | null, deps?: Partial<CallDeps>) {
    this.session = session;
    this.localStream = localStream;
    this.deps = { ...defaultDeps(), ...deps };
    this.isCreator = session.role === "CREATOR";
    this.publishes = session.role !== "GUARDIAN";
    const audio = this.tracks("audio");
    const video = this.tracks("video");
    this.state = {
      phase: "connecting",
      reconnecting: false,
      connection: "connecting",
      remoteStream: null,
      peerName: session.peerName,
      peerRole: null,
      peerMedia: { audio: true, video: true, screen: false },
      localAudio: this.publishes && audio.some((track) => track.enabled),
      localVideo: this.publishes && video.some((track) => track.enabled),
      screenSharing: false,
      screenStream: null,
      localVersion: 0,
      endedReason: null,
      refusal: null,
      endingMinutes: null,
    };
  }

  // ---- store -----------------------------------------------------------------------------------

  readonly subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  readonly getState = (): CallState => this.state;

  private update(patch: Partial<CallState>): void {
    const next = { ...this.state, ...patch };
    next.phase = next.endedReason
      ? "ended"
      : next.refusal
        ? "refused"
        : this.peerPresent || this.iceConnected
          ? "in-call"
          : this.welcomed
            ? "waiting"
            : "connecting";
    this.state = next;
    this.listeners.forEach((listener) => listener());
  }

  // ---- lifecycle -------------------------------------------------------------------------------

  /**
   * Connects on the next tick, so a React StrictMode mount-unmount-mount never spends the
   * single-use ticket on a socket that is closed straight away.
   */
  start(): void {
    this.disposed = false;
    if (this.startTimer !== null || this.socket !== null || this.isOver()) return;
    this.startTimer = setTimeout(() => {
      this.startTimer = null;
      const expires = this.session.ticketExpiresAt ? Date.parse(this.session.ticketExpiresAt) : 0;
      if (this.session.ticket && expires - Date.now() > TICKET_MARGIN_MS) {
        this.connectSocket(this.session.ticket);
      } else {
        this.rejoin();
      }
    }, 0);
    this.deps.events?.addEventListener("online", this.onOnline);
  }

  /** Tears everything down without telling anyone - the page is going away. */
  dispose(): void {
    this.disposed = true;
    this.clearTimers();
    this.deps.events?.removeEventListener("online", this.onOnline);
    this.socket?.close();
    this.socket = null;
    this.closePeerConnection();
    this.releaseScreen();
  }

  private isOver(): boolean {
    return this.state.endedReason !== null || this.state.refusal !== null;
  }

  private clearTimers(): void {
    if (this.startTimer !== null) clearTimeout(this.startTimer);
    if (this.reconnectTimer !== null) clearTimeout(this.reconnectTimer);
    if (this.disconnectTimer !== null) clearTimeout(this.disconnectTimer);
    if (this.statsTimer !== null) clearInterval(this.statsTimer);
    this.startTimer = this.reconnectTimer = this.disconnectTimer = this.statsTimer = null;
  }

  private finish(reason: CallEndReason): void {
    if (this.isOver()) return;
    this.dispose();
    this.iceConnected = false;
    this.peerPresent = false;
    this.update({
      endedReason: reason,
      screenSharing: false,
      screenStream: null,
      remoteStream: null,
      reconnecting: false,
      connection: "connecting",
    });
  }

  private refuse(reason: RefusalReason): void {
    if (this.isOver()) return;
    this.dispose();
    this.iceConnected = false;
    this.peerPresent = false;
    this.update({
      refusal: reason,
      remoteStream: null,
      reconnecting: false,
      screenSharing: false,
      screenStream: null,
    });
  }

  // ---- signalling ------------------------------------------------------------------------------

  private connectSocket(ticket: string): void {
    if (this.disposed || this.isOver()) return;
    const url = socketUrl(this.session.signallingUrl ?? "/ws/rtc", this.deps.location);
    const socket = new SignallingClient(
      url,
      ticket,
      {
        onMessage: (message) => {
          if (this.socket === socket) this.onSignal(message);
        },
        onClose: (code) => {
          if (this.socket === socket) {
            this.socket = null;
            this.onSocketClosed(code);
          }
        },
      },
      this.deps.WebSocket,
    );
    this.socket = socket;
    socket.connect();
  }

  private onSocketClosed(code: number): void {
    if (this.disposed || this.isOver()) return;
    const kind = closeKind(code);
    if (kind === "ended") {
      this.finish("creator-ended");
    } else if (kind === "replaced" || kind === "full") {
      this.refuse(kind);
    } else if (kind === "refused") {
      // A ticket that expired while the page sat open gets one retry with a fresh one.
      if (code === CLOSE_BAD_TICKET && !this.freshTicketTried) {
        this.freshTicketTried = true;
        this.rejoin();
      } else {
        this.refuse("refused");
      }
    } else {
      this.update({ reconnecting: true });
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer !== null) return;
    const delay = Math.min(1000 * 2 ** this.reconnectAttempts, MAX_BACKOFF_MS);
    this.reconnectAttempts += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.rejoin();
    }, delay);
  }

  private readonly onOnline = (): void => {
    if (this.state.reconnecting && this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
      this.rejoin();
    }
  };

  /** A fresh `POST …/join` for a new ticket, then a new socket. */
  private rejoin(): void {
    if (this.disposed || this.isOver()) return;
    this.deps
      .join(this.session.occurrenceId)
      .then((view) => {
        if (this.disposed || this.isOver()) return;
        if (view.meetingMode !== "DIRECT" || !view.ticket) {
          this.finish("unavailable");
          return;
        }
        this.connectSocket(view.ticket);
      })
      .catch((error: unknown) => {
        if (this.disposed || this.isOver()) return;
        // The API refusing outright (window closed, cancelled, removed) won't change on a retry.
        if (
          error instanceof ApiError &&
          error.status >= 400 &&
          error.status < 500 &&
          error.status !== 429
        ) {
          this.finish("unavailable");
        } else {
          this.update({ reconnecting: true });
          this.scheduleReconnect();
        }
      });
  }

  private send(message: Parameters<SignallingClient["send"]>[0]): void {
    this.socket?.send(message);
  }

  private onSignal(message: SignalIn): void {
    switch (message.type) {
      case "welcome":
        this.welcomed = true;
        this.reconnectAttempts = 0;
        this.freshTicketTried = false;
        this.peerPresent = message.peerPresent;
        this.update({ reconnecting: false });
        if (this.isCreator) {
          if (message.peerPresent) this.restartWith(true);
        } else {
          this.resetPeerConnection();
        }
        break;
      case "peer-joined":
        this.peerPresent = true;
        this.update({ peerName: message.name ?? this.state.peerName, peerRole: message.role });
        this.restartWith(this.isCreator);
        break;
      case "peer-left":
        this.peerPresent = false;
        if (message.reason === "left") {
          // They hung up: their connection is closed, so ours is useless.
          this.closePeerConnection();
          this.iceConnected = false;
          this.update({ remoteStream: null, connection: "connecting" });
        } else {
          // Their socket dropped or moved to another tab; media may still be flowing.
          this.update({});
        }
        break;
      case "offer":
        void this.onOffer(message.sdp);
        break;
      case "answer":
        void this.onAnswer(message.sdp);
        break;
      case "ice":
        this.onRemoteCandidate(message);
        break;
      case "media-state":
        this.update({
          peerMedia: { audio: message.audio, video: message.video, screen: message.screen },
        });
        break;
      case "session-ending":
        this.update({ endingMinutes: message.minutesLeft });
        break;
      case "ended":
        this.finish(
          message.reason === "window-closed" || message.reason === "cancelled"
            ? message.reason
            : "creator-ended",
        );
        break;
      case "error":
        // room-full / not-joinable arrive just before their close code, which decides what happens.
        break;
      default:
        break;
    }
  }

  // ---- peer connection -------------------------------------------------------------------------

  /** Starts over with a fresh peer connection; the creator then offers. */
  private restartWith(offer: boolean): void {
    this.resetPeerConnection();
    if (offer) void this.makeOffer(false);
  }

  private resetPeerConnection(): void {
    this.closePeerConnection();
    this.iceConnected = false;
    this.previousLoss = { lost: 0, received: 0 };
    this.connectionReported = false;
    this.update({
      remoteStream: null,
      connection: "connecting",
      peerMedia: { audio: true, video: true, screen: false },
    });
    this.pc = this.createPeerConnection();
  }

  private closePeerConnection(): void {
    const pc = this.pc;
    this.pc = null;
    this.pendingCandidates = [];
    this.offerQueued = false;
    if (this.disconnectTimer !== null) clearTimeout(this.disconnectTimer);
    if (this.statsTimer !== null) clearInterval(this.statsTimer);
    if (this.failedReportTimer !== null) clearTimeout(this.failedReportTimer);
    this.disconnectTimer = this.statsTimer = this.failedReportTimer = null;
    if (pc) {
      pc.onicecandidate = null;
      pc.ontrack = null;
      pc.oniceconnectionstatechange = null;
      try {
        pc.close();
      } catch {
        // already closed
      }
    }
  }

  private createPeerConnection(): RTCPeerConnection {
    const pc = new this.deps.RTCPeerConnection({
      iceServers: toRtcIceServers(this.session.iceServers),
    });
    if (this.publishes && this.localStream) {
      const stream = this.localStream;
      const screen = this.screenTrack;
      stream.getTracks().forEach((track) => {
        // While sharing, the screen goes out in the camera's place.
        if (!(screen && track.kind === "video")) pc.addTrack(track, stream);
      });
      if (screen) pc.addTrack(screen, stream);
    }
    pc.onicecandidate = (event) => {
      // The end-of-candidates marker (null) isn't sent: nothing on the floor needs it.
      if (this.pc !== pc || !event.candidate) return;
      this.send({
        type: "ice",
        candidate: event.candidate.candidate,
        sdpMid: event.candidate.sdpMid ?? null,
        sdpMLineIndex: event.candidate.sdpMLineIndex ?? null,
      });
    };
    pc.ontrack = (event) => {
      if (this.pc !== pc) return;
      let stream = event.streams && event.streams[0];
      if (!stream) {
        stream = this.state.remoteStream ?? new this.deps.MediaStream();
        stream.addTrack(event.track);
      }
      this.update({ remoteStream: stream });
    };
    pc.oniceconnectionstatechange = () => {
      if (this.pc === pc) this.onIceState(pc);
    };
    return pc;
  }

  private onIceState(pc: RTCPeerConnection): void {
    const ice = pc.iceConnectionState;
    if (ice === "connected" || ice === "completed") {
      if (this.disconnectTimer !== null) clearTimeout(this.disconnectTimer);
      this.disconnectTimer = null;
      this.iceConnected = true;
      const settled = this.state.connection !== "connecting" && this.state.connection !== "failed";
      this.update({ connection: settled ? this.state.connection : "direct" });
      this.startStats(pc);
    } else if (ice === "disconnected") {
      this.update({ connection: "poor" });
      if (this.disconnectTimer === null) {
        this.disconnectTimer = setTimeout(() => {
          this.disconnectTimer = null;
          if (this.pc === pc && pc.iceConnectionState === "disconnected") this.restartIce();
        }, DISCONNECTED_RESTART_MS);
      }
    } else if (ice === "failed") {
      this.iceConnected = false;
      this.update({ connection: "failed" });
      if (!this.connectionReported && this.failedReportTimer === null) {
        // Reported only if the ICE restart doesn't rescue it; a recovery reports direct/relay instead.
        this.failedReportTimer = setTimeout(() => {
          this.failedReportTimer = null;
          if (this.pc === pc && !this.iceConnected) this.reportConnection("failed");
        }, FAILED_REPORT_MS);
      }
      if (this.peerPresent) {
        this.restartIce();
      } else {
        // Nobody to renegotiate with: wait for them to come back to a clean connection.
        this.closePeerConnection();
        this.update({ remoteStream: null, connection: "connecting" });
      }
    }
  }

  /** The creator's recovery (§4.4): a new offer with fresh ICE credentials. Learners wait for it. */
  private restartIce(): void {
    if (!this.isCreator || !this.peerPresent || !this.pc) return;
    void this.makeOffer(true);
  }

  private async makeOffer(iceRestart: boolean): Promise<void> {
    const pc = this.pc;
    if (!pc) return;
    if (pc.signalingState !== "stable") {
      this.offerQueued = true;
      return;
    }
    try {
      const options: RTCOfferOptions = { offerToReceiveAudio: true, offerToReceiveVideo: true };
      if (iceRestart) options.iceRestart = true;
      const offer = await pc.createOffer(options);
      if (this.pc !== pc) return;
      await pc.setLocalDescription(offer);
      if (this.pc !== pc) return;
      this.send({ type: "offer", sdp: pc.localDescription?.sdp ?? offer.sdp ?? "" });
    } catch (error) {
      console.warn("[direct-call] offer failed", error);
    }
  }

  private async onOffer(sdp: string): Promise<void> {
    if (this.isCreator) return; // the creator never answers (§4.4)
    if (!this.pc) this.pc = this.createPeerConnection();
    const pc = this.pc;
    try {
      await pc.setRemoteDescription({ type: "offer", sdp });
      if (this.pc !== pc) return;
      this.flushCandidates(pc);
      const answer = await pc.createAnswer();
      if (this.pc !== pc) return;
      await pc.setLocalDescription(answer);
      if (this.pc !== pc) return;
      this.send({ type: "answer", sdp: pc.localDescription?.sdp ?? answer.sdp ?? "" });
      this.sendMediaState();
    } catch (error) {
      console.warn("[direct-call] answering failed", error);
    }
  }

  private async onAnswer(sdp: string): Promise<void> {
    const pc = this.pc;
    if (!this.isCreator || !pc || pc.signalingState !== "have-local-offer") return;
    try {
      await pc.setRemoteDescription({ type: "answer", sdp });
      if (this.pc !== pc) return;
      this.flushCandidates(pc);
      this.sendMediaState();
      if (this.offerQueued) {
        this.offerQueued = false;
        void this.makeOffer(true);
      }
    } catch (error) {
      console.warn("[direct-call] applying the answer failed", error);
    }
  }

  private onRemoteCandidate(message: Extract<SignalIn, { type: "ice" }>): void {
    if (message.candidate === null) return;
    const candidate: RTCIceCandidateInit = {
      candidate: message.candidate,
      sdpMid: message.sdpMid,
      sdpMLineIndex: message.sdpMLineIndex,
    };
    const pc = this.pc;
    if (!pc || !pc.remoteDescription) {
      this.pendingCandidates.push(candidate);
      return;
    }
    pc.addIceCandidate(candidate).catch((error: unknown) =>
      console.warn("[direct-call] bad candidate", error),
    );
  }

  private flushCandidates(pc: RTCPeerConnection): void {
    const queued = this.pendingCandidates;
    this.pendingCandidates = [];
    queued.forEach((candidate) =>
      pc
        .addIceCandidate(candidate)
        .catch((error: unknown) => console.warn("[direct-call] bad candidate", error)),
    );
  }

  // ---- stats -----------------------------------------------------------------------------------

  private startStats(pc: RTCPeerConnection): void {
    if (this.statsTimer !== null) return;
    const sample = () => {
      if (this.pc !== pc) return;
      pc.getStats()
        .then((report) => {
          if (this.pc !== pc || !this.iceConnected) return;
          const stats = analyzeStats(report);
          const lost = stats.packetsLost - this.previousLoss.lost;
          const received = stats.packetsReceived - this.previousLoss.received;
          this.previousLoss = { lost: stats.packetsLost, received: stats.packetsReceived };
          const lossRate = lost + received > 0 ? lost / (lost + received) : 0;
          const poor =
            lossRate > POOR_LOSS ||
            (stats.rttSeconds !== null && stats.rttSeconds > POOR_RTT_SECONDS);
          if (stats.path) this.reportConnection(stats.path);
          if (pc.iceConnectionState === "disconnected") return;
          this.update({ connection: poor ? "poor" : (stats.path ?? "direct") });
        })
        .catch(() => undefined);
    };
    sample();
    this.statsTimer = setInterval(sample, STATS_INTERVAL_MS);
  }

  /** Sends this peer connection's beacon once; a failure is ignored - it is only for metrics. */
  private reportConnection(connection: CallConnectionType): void {
    if (this.connectionReported) return;
    this.connectionReported = true;
    if (this.failedReportTimer !== null) clearTimeout(this.failedReportTimer);
    this.failedReportTimer = null;
    try {
      this.deps.reportConnection(this.session.occurrenceId, connection).catch(() => undefined);
    } catch {
      // best effort
    }
  }

  // ---- local media -----------------------------------------------------------------------------

  private tracks(kind: "audio" | "video"): MediaStreamTrack[] {
    if (!this.localStream) return [];
    return kind === "audio" ? this.localStream.getAudioTracks() : this.localStream.getVideoTracks();
  }

  private sendMediaState(): void {
    const screen = this.state.screenSharing;
    this.send({
      type: "media-state",
      audio: this.state.localAudio,
      video: this.state.localVideo || screen,
      screen,
    });
  }

  toggleAudio(): void {
    const tracks = this.tracks("audio");
    if (!this.publishes || tracks.length === 0) return;
    const enabled = !this.state.localAudio;
    tracks.forEach((track) => (track.enabled = enabled));
    this.update({ localAudio: enabled });
    this.sendMediaState();
  }

  toggleVideo(): void {
    const tracks = this.tracks("video");
    // The camera stays off while the screen is shared; stopping the share brings it back.
    if (!this.publishes || tracks.length === 0 || this.state.screenSharing) return;
    const enabled = !this.state.localVideo;
    tracks.forEach((track) => (track.enabled = enabled));
    this.update({ localVideo: enabled });
    this.sendMediaState();
  }

  /** Swaps the camera (see `swapOutgoingVideo`). */
  async switchCamera(deviceId: string): Promise<void> {
    const stream = this.localStream;
    const old = this.tracks("video")[0];
    if (!this.publishes || !stream || !old) return;
    const fresh = (
      await this.deps.getUserMedia({ video: { deviceId: { exact: deviceId } } })
    ).getVideoTracks()[0];
    if (!fresh) return;
    if (this.disposed || this.isOver()) {
      fresh.stop();
      return;
    }
    fresh.enabled = this.state.screenSharing ? false : this.state.localVideo;
    // While sharing, the screen holds the sender; the new camera takes over when sharing stops.
    const pc = this.pc;
    if (pc && !this.screenTrack && pc.getSenders().some((sender) => sender.track === old)) {
      await this.swapOutgoingVideo(old, fresh);
    }
    stream.removeTrack(old);
    stream.addTrack(fresh);
    old.stop();
    this.update({ localVersion: this.state.localVersion + 1 });
  }

  /**
   * Puts `fresh` on the wire where `old` was: `replaceTrack` where it exists; otherwise (Chrome 64's
   * Plan B) remove and re-add, which reaches the other side with the creator's next offer - straight
   * away when this is the creator. With no sender carrying `old` (a creator who joined
   * microphone-only starting a screen share), `fresh` is added and the creator offers again.
   */
  private async swapOutgoingVideo(
    old: MediaStreamTrack | null,
    fresh: MediaStreamTrack,
  ): Promise<void> {
    const pc = this.pc;
    const stream = this.localStream;
    if (!pc || !stream) return;
    const sender = old ? pc.getSenders().find((candidate) => candidate.track === old) : undefined;
    if (sender && typeof sender.replaceTrack === "function") {
      await sender.replaceTrack(fresh);
      return;
    }
    if (sender) pc.removeTrack(sender);
    pc.addTrack(fresh, stream);
    if (this.isCreator) void this.makeOffer(false);
  }

  /** Takes the screen track off the wire: back to the camera, or nothing when there is none. */
  private async restoreOutgoingVideo(screen: MediaStreamTrack): Promise<void> {
    const camera = this.tracks("video")[0];
    if (camera) {
      await this.swapOutgoingVideo(screen, camera);
      return;
    }
    const pc = this.pc;
    const sender = pc?.getSenders().find((candidate) => candidate.track === screen);
    if (pc && sender) {
      pc.removeTrack(sender);
      if (this.isCreator) void this.makeOffer(false);
    }
  }

  /**
   * The tutor shares a screen, window or tab in place of their camera, which is switched off for as
   * long as the share lasts. Only the creator shares: as the offerer it is the side that can
   * renegotiate when there is no video sender to reuse. A cancelled picker changes nothing.
   */
  async startScreenShare(): Promise<void> {
    const getDisplayMedia = this.deps.getDisplayMedia;
    if (
      !this.isCreator ||
      !this.publishes ||
      !this.localStream ||
      !getDisplayMedia ||
      this.screenTrack ||
      this.screenPending ||
      this.isOver()
    ) {
      return;
    }
    this.screenPending = true;
    let display: MediaStream;
    try {
      display = await getDisplayMedia({ video: true, audio: false });
    } catch {
      // NotAllowedError when the picker is cancelled; nothing to undo.
      return;
    } finally {
      this.screenPending = false;
    }
    const screen = display.getVideoTracks()[0];
    if (!screen) return;
    if (this.disposed || this.isOver()) {
      display.getTracks().forEach((track) => track.stop());
      return;
    }
    const cameras = this.tracks("video");
    this.cameraWasOn = this.state.localVideo;
    cameras.forEach((track) => (track.enabled = false));
    this.screenTrack = screen;
    // The browser's own "Stop sharing" bar ends the track.
    screen.onended = () => void this.stopScreenShare();
    this.update({ screenSharing: true, screenStream: display, localVideo: false });
    await this.swapOutgoingVideo(cameras[0] ?? null, screen);
    this.sendMediaState();
  }

  /** Stops sharing and puts the camera back the way it was before. */
  async stopScreenShare(): Promise<void> {
    const screen = this.screenTrack;
    if (!screen) return;
    this.screenTrack = null;
    screen.onended = null;
    const cameraOn = this.cameraWasOn && this.tracks("video").length > 0;
    this.tracks("video").forEach((track) => (track.enabled = cameraOn));
    this.update({ screenSharing: false, screenStream: null, localVideo: cameraOn });
    if (!this.disposed && !this.isOver()) {
      await this.restoreOutgoingVideo(screen);
      this.sendMediaState();
    }
    screen.stop();
  }

  /** Stops the screen track without renegotiating - the call is going away. */
  private releaseScreen(): void {
    const screen = this.screenTrack;
    if (!screen) return;
    this.screenTrack = null;
    screen.onended = null;
    screen.stop();
  }

  /**
   * Leaves the call. From the creator, the server ends it for both sides (§4.5); from a learner or
   * guardian, the room stays open for them to rejoin.
   */
  hangup(): void {
    if (this.isOver()) return;
    this.send({ type: "hangup" });
    this.finish(this.isCreator ? "creator-ended" : "left");
  }
}

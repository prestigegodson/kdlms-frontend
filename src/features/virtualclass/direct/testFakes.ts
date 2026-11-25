import { vi } from "vitest";
import type { JoinView } from "@/api/liveSessions";

/** Test doubles for one-on-one call tests: a WebSocket and an RTCPeerConnection that record what they're asked to do. */

export class FakeSocket {
  static instances: FakeSocket[] = [];
  readyState = 0;
  sent: Record<string, unknown>[] = [];
  closedWith: number | null = null;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: ((event: { code: number }) => void) | null = null;
  readonly url: string;

  constructor(url: string) {
    this.url = url;
    FakeSocket.instances.push(this);
  }

  static latest(): FakeSocket {
    return FakeSocket.instances[FakeSocket.instances.length - 1];
  }

  send(text: string) {
    this.sent.push(JSON.parse(text) as Record<string, unknown>);
  }

  close(code?: number) {
    this.readyState = 3;
    this.closedWith = code ?? 1000;
  }

  open() {
    this.readyState = 1;
    this.onopen?.();
  }

  receive(message: Record<string, unknown>) {
    this.onmessage?.({ data: JSON.stringify(message) });
  }

  drop(code: number) {
    this.readyState = 3;
    this.onclose?.({ code });
  }

  types(): unknown[] {
    return this.sent.map((frame) => frame.type);
  }
}

type Description = { type: string; sdp?: string };

export class FakeSender {
  track: MediaStreamTrack | null;
  replaceTrack = vi.fn(async (track: MediaStreamTrack | null) => {
    this.track = track;
  });

  constructor(track: MediaStreamTrack) {
    this.track = track;
  }
}

export class FakePeerConnection {
  static instances: FakePeerConnection[] = [];
  readonly config: RTCConfiguration;
  signalingState = "stable";
  iceConnectionState = "new";
  remoteDescription: Description | null = null;
  localDescription: Description | null = null;
  onicecandidate: ((event: { candidate: unknown }) => void) | null = null;
  ontrack: ((event: unknown) => void) | null = null;
  oniceconnectionstatechange: (() => void) | null = null;

  createOffer = vi.fn(async (options?: RTCOfferOptions) => ({
    type: "offer",
    sdp: options?.iceRestart ? "restart-offer-sdp" : "offer-sdp",
  }));
  createAnswer = vi.fn(async () => ({ type: "answer", sdp: "answer-sdp" }));
  setLocalDescription = vi.fn(async (description: Description) => {
    this.localDescription = description;
    this.signalingState = description.type === "offer" ? "have-local-offer" : "stable";
  });
  setRemoteDescription = vi.fn(async (description: Description) => {
    this.remoteDescription = description;
    this.signalingState = description.type === "offer" ? "have-remote-offer" : "stable";
  });
  addIceCandidate = vi.fn(async () => undefined);
  senders: FakeSender[] = [];
  addTrack = vi.fn((track: MediaStreamTrack) => {
    const sender = new FakeSender(track);
    this.senders.push(sender);
    return sender;
  });
  removeTrack = vi.fn((sender: FakeSender) => {
    this.senders = this.senders.filter((candidate) => candidate !== sender);
  });
  getSenders = vi.fn(() => [...this.senders]);
  getStats = vi.fn(async () => new Map());
  close = vi.fn();

  constructor(config: RTCConfiguration) {
    this.config = config;
    FakePeerConnection.instances.push(this);
  }

  static latest(): FakePeerConnection {
    return FakePeerConnection.instances[FakePeerConnection.instances.length - 1];
  }

  setIce(state: string) {
    this.iceConnectionState = state;
    this.oniceconnectionstatechange?.();
  }
}

export function fakeTrack(kind: "audio" | "video") {
  return { kind, enabled: true, stop: vi.fn(), onended: null } as unknown as MediaStreamTrack;
}

export function fakeStream(tracks: MediaStreamTrack[]): MediaStream {
  const list = [...tracks];
  return {
    getTracks: () => [...list],
    getAudioTracks: () => list.filter((track) => track.kind === "audio"),
    getVideoTracks: () => list.filter((track) => track.kind === "video"),
    addTrack: (track: MediaStreamTrack) => list.push(track),
    removeTrack: (track: MediaStreamTrack) => list.splice(list.indexOf(track), 1),
  } as unknown as MediaStream;
}

export function directSession(overrides: Partial<JoinView> = {}): JoinView {
  return {
    occurrenceId: "o1",
    className: "Algebra",
    scheduledStart: "2026-10-05T08:00:00Z",
    scheduledEnd: "2026-10-05T09:00:00Z",
    serverUrl: null,
    token: null,
    roomName: null,
    role: "CREATOR",
    expiresAt: "2026-10-05T09:15:00Z",
    meetingMode: "DIRECT",
    meetingUrl: null,
    meetingProvider: null,
    signallingUrl: "/ws/rtc",
    ticket: "ticket-1",
    ticketExpiresAt: new Date(Date.now() + 60_000).toISOString(),
    iceServers: [
      { urls: ["stun:turn.test:3478"], username: null, credential: null },
      { urls: ["turn:turn.test:3478"], username: "123:u1", credential: "secret" },
    ],
    peerName: "Ada Lovelace",
    ...overrides,
  };
}

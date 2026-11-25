import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/api/client";
import type { JoinView } from "@/api/liveSessions";
import {
  analyzeStats,
  type CallDeps,
  DirectCallController,
  DISCONNECTED_RESTART_MS,
  FAILED_REPORT_MS,
} from "./callController";
import { directSession, FakePeerConnection, FakeSocket, fakeStream, fakeTrack } from "./testFakes";

function setup(
  overrides: Partial<JoinView> = {},
  stream: MediaStream | null = null,
  join?: CallDeps["join"],
  getDisplayMedia: CallDeps["getDisplayMedia"] = null,
) {
  const session = directSession(overrides);
  const joinFn = vi.fn(join ?? (async () => directSession({ ...overrides, ticket: "ticket-2" })));
  const reportConnection = vi.fn(async () => undefined);
  const controller = new DirectCallController(session, stream, {
    RTCPeerConnection: FakePeerConnection as unknown as typeof RTCPeerConnection,
    WebSocket: FakeSocket as unknown as CallDeps["WebSocket"],
    MediaStream: class {} as unknown as typeof MediaStream,
    join: joinFn,
    getUserMedia: vi.fn(),
    getDisplayMedia,
    location: { protocol: "https:", host: "app.test" },
    events: null,
    reportConnection,
  });
  return { controller, join: joinFn, reportConnection };
}

/** Starts the call and lets its deferred connect run; returns the opened socket. */
async function started(controller: DirectCallController): Promise<FakeSocket> {
  controller.start();
  await vi.advanceTimersByTimeAsync(0);
  const socket = FakeSocket.latest();
  socket.open();
  return socket;
}

const flush = () => vi.advanceTimersByTimeAsync(0);

/** A stats report whose selected pair goes through TURN. */
function relayedStats(): Map<string, unknown> {
  return new Map<string, unknown>([
    ["t", { id: "t", type: "transport", selectedCandidatePairId: "p" }],
    ["p", { id: "p", type: "candidate-pair", localCandidateId: "l", remoteCandidateId: "r" }],
    ["l", { id: "l", type: "local-candidate", candidateType: "relay" }],
    ["r", { id: "r", type: "remote-candidate", candidateType: "host" }],
  ]);
}

describe("DirectCallController", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    FakeSocket.instances = [];
    FakePeerConnection.instances = [];
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("connects to the same-origin socket and says hello with the join's ticket", async () => {
    const { controller } = setup();
    const socket = await started(controller);
    expect(socket.url).toBe("wss://app.test/ws/rtc");
    expect(socket.sent[0]).toEqual({ type: "hello", ticket: "ticket-1" });
    expect(controller.getState().phase).toBe("connecting");
  });

  it("never opens a socket when unmounted before the deferred connect (StrictMode)", async () => {
    const { controller } = setup();
    controller.start();
    controller.dispose();
    controller.start();
    await flush();
    expect(FakeSocket.instances).toHaveLength(1);
  });

  it("swaps a ticket about to expire for a fresh one first", async () => {
    const { controller, join } = setup({
      ticketExpiresAt: new Date(Date.now() + 5_000).toISOString(),
    });
    controller.start();
    await flush();
    expect(join).toHaveBeenCalledWith("o1");
    FakeSocket.latest().open();
    expect(FakeSocket.latest().sent[0]).toEqual({ type: "hello", ticket: "ticket-2" });
  });

  describe("as the creator", () => {
    it("waits, then offers when the learner joins", async () => {
      const { controller } = setup(
        { role: "CREATOR" },
        fakeStream([fakeTrack("audio"), fakeTrack("video")]),
      );
      const socket = await started(controller);
      socket.receive({ type: "welcome", role: "CREATOR", peerPresent: false, expiresAt: "x" });
      expect(controller.getState().phase).toBe("waiting");
      expect(FakePeerConnection.instances).toHaveLength(0);

      socket.receive({ type: "peer-joined", role: "LEARNER", name: "Grace Hopper" });
      await flush();
      const pc = FakePeerConnection.latest();
      expect(pc.config.iceServers).toEqual([
        { urls: ["stun:turn.test:3478"] },
        { urls: ["turn:turn.test:3478"], username: "123:u1", credential: "secret" },
      ]);
      expect(pc.addTrack).toHaveBeenCalledTimes(2);
      expect(pc.createOffer).toHaveBeenCalledWith({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });
      expect(pc.setLocalDescription).toHaveBeenCalledWith({ type: "offer", sdp: "offer-sdp" });
      expect(socket.sent).toContainEqual({ type: "offer", sdp: "offer-sdp" });
      expect(controller.getState()).toMatchObject({
        phase: "in-call",
        peerName: "Grace Hopper",
        peerRole: "LEARNER",
      });
    });

    it("offers straight away when the learner is already there", async () => {
      const { controller } = setup({ role: "CREATOR" });
      const socket = await started(controller);
      socket.receive({ type: "welcome", role: "CREATOR", peerPresent: true, expiresAt: "x" });
      await flush();
      expect(FakePeerConnection.latest().createOffer).toHaveBeenCalledTimes(1);
      expect(socket.types()).toContain("offer");
    });

    it("applies the answer, flushes queued candidates and shares its media state", async () => {
      const { controller } = setup({ role: "CREATOR" }, fakeStream([fakeTrack("audio")]));
      const socket = await started(controller);
      socket.receive({ type: "welcome", role: "CREATOR", peerPresent: true, expiresAt: "x" });
      await flush();
      const pc = FakePeerConnection.latest();
      socket.receive({ type: "ice", candidate: "candidate:1", sdpMid: "0", sdpMLineIndex: 0 });
      expect(pc.addIceCandidate).not.toHaveBeenCalled();
      socket.receive({ type: "answer", sdp: "answer-sdp" });
      await flush();
      expect(pc.setRemoteDescription).toHaveBeenCalledWith({ type: "answer", sdp: "answer-sdp" });
      expect(pc.addIceCandidate).toHaveBeenCalledWith({
        candidate: "candidate:1",
        sdpMid: "0",
        sdpMLineIndex: 0,
      });
      expect(socket.sent).toContainEqual({
        type: "media-state",
        audio: true,
        video: false,
        screen: false,
      });
    });

    it("restarts ICE when the connection fails", async () => {
      const { controller } = setup({ role: "CREATOR" });
      const socket = await started(controller);
      socket.receive({ type: "welcome", role: "CREATOR", peerPresent: true, expiresAt: "x" });
      await flush();
      const pc = FakePeerConnection.latest();
      socket.receive({ type: "answer", sdp: "answer-sdp" });
      await flush();
      pc.setIce("failed");
      await flush();
      expect(pc.createOffer).toHaveBeenLastCalledWith({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
        iceRestart: true,
      });
      expect(socket.sent).toContainEqual({ type: "offer", sdp: "restart-offer-sdp" });
    });

    it("reports the connection path once per peer connection", async () => {
      const { controller, reportConnection } = setup({ role: "CREATOR" });
      const socket = await started(controller);
      socket.receive({ type: "welcome", role: "CREATOR", peerPresent: true, expiresAt: "x" });
      await flush();
      const pc = FakePeerConnection.latest();
      pc.getStats.mockResolvedValue(relayedStats());
      pc.setIce("connected");
      await flush();
      expect(reportConnection).toHaveBeenCalledWith("o1", "relay");
      await vi.advanceTimersByTimeAsync(10_000);
      expect(reportConnection).toHaveBeenCalledTimes(1);
    });

    it("reports failed only when the ICE restart doesn't rescue the call", async () => {
      const { controller, reportConnection } = setup({ role: "CREATOR" });
      const socket = await started(controller);
      socket.receive({ type: "welcome", role: "CREATOR", peerPresent: true, expiresAt: "x" });
      await flush();
      const pc = FakePeerConnection.latest();
      pc.setIce("failed");
      await vi.advanceTimersByTimeAsync(FAILED_REPORT_MS - 100);
      expect(reportConnection).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(200);
      expect(reportConnection).toHaveBeenCalledWith("o1", "failed");
    });

    it("reports the recovered path, not failed, when the ICE restart works", async () => {
      const { controller, reportConnection } = setup({ role: "CREATOR" });
      const socket = await started(controller);
      socket.receive({ type: "welcome", role: "CREATOR", peerPresent: true, expiresAt: "x" });
      await flush();
      const pc = FakePeerConnection.latest();
      pc.setIce("failed");
      await flush();
      pc.getStats.mockResolvedValue(relayedStats());
      pc.setIce("connected");
      await vi.advanceTimersByTimeAsync(FAILED_REPORT_MS * 2);
      expect(reportConnection).toHaveBeenCalledTimes(1);
      expect(reportConnection).toHaveBeenCalledWith("o1", "relay");
    });

    it("restarts ICE after five seconds disconnected, not before", async () => {
      const { controller } = setup({ role: "CREATOR" });
      const socket = await started(controller);
      socket.receive({ type: "welcome", role: "CREATOR", peerPresent: true, expiresAt: "x" });
      await flush();
      const pc = FakePeerConnection.latest();
      socket.receive({ type: "answer", sdp: "answer-sdp" });
      await flush();
      pc.setIce("connected");
      pc.setIce("disconnected");
      await vi.advanceTimersByTimeAsync(DISCONNECTED_RESTART_MS - 100);
      expect(pc.createOffer).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(200);
      expect(pc.createOffer).toHaveBeenCalledTimes(2);
      expect(pc.createOffer).toHaveBeenLastCalledWith(
        expect.objectContaining({ iceRestart: true }),
      );
    });

    it("ends the lesson for both with a hangup", async () => {
      const { controller } = setup({ role: "CREATOR" });
      const socket = await started(controller);
      socket.receive({ type: "welcome", role: "CREATOR", peerPresent: true, expiresAt: "x" });
      await flush();
      controller.hangup();
      expect(socket.types()).toContain("hangup");
      expect(FakePeerConnection.latest().close).toHaveBeenCalled();
      expect(controller.getState()).toMatchObject({ phase: "ended", endedReason: "creator-ended" });
    });
  });

  describe("as the learner", () => {
    it("never offers, and answers the creator's offer", async () => {
      const { controller } = setup(
        { role: "LEARNER" },
        fakeStream([fakeTrack("audio"), fakeTrack("video")]),
      );
      const socket = await started(controller);
      socket.receive({ type: "welcome", role: "LEARNER", peerPresent: true, expiresAt: "x" });
      socket.receive({ type: "peer-joined", role: "CREATOR", name: "Tutor" });
      await flush();
      const pc = FakePeerConnection.latest();
      expect(pc.createOffer).not.toHaveBeenCalled();

      socket.receive({ type: "offer", sdp: "offer-sdp" });
      await flush();
      expect(pc.setRemoteDescription).toHaveBeenCalledWith({ type: "offer", sdp: "offer-sdp" });
      expect(pc.setLocalDescription).toHaveBeenCalledWith({ type: "answer", sdp: "answer-sdp" });
      expect(socket.sent).toContainEqual({ type: "answer", sdp: "answer-sdp" });
      expect(socket.sent).toContainEqual({
        type: "media-state",
        audio: true,
        video: true,
        screen: false,
      });
      expect(pc.createOffer).not.toHaveBeenCalled();
    });

    it("queues candidates that arrive before the offer", async () => {
      const { controller } = setup({ role: "LEARNER" });
      const socket = await started(controller);
      socket.receive({ type: "welcome", role: "LEARNER", peerPresent: true, expiresAt: "x" });
      const pc = FakePeerConnection.latest();
      socket.receive({ type: "ice", candidate: "candidate:9", sdpMid: "0", sdpMLineIndex: 0 });
      expect(pc.addIceCandidate).not.toHaveBeenCalled();
      socket.receive({ type: "offer", sdp: "offer-sdp" });
      await flush();
      expect(pc.addIceCandidate).toHaveBeenCalledWith({
        candidate: "candidate:9",
        sdpMid: "0",
        sdpMLineIndex: 0,
      });
    });

    it("leaves ICE restarts to the creator", async () => {
      const { controller } = setup({ role: "LEARNER" });
      const socket = await started(controller);
      socket.receive({ type: "welcome", role: "LEARNER", peerPresent: true, expiresAt: "x" });
      socket.receive({ type: "offer", sdp: "offer-sdp" });
      await flush();
      const pc = FakePeerConnection.latest();
      pc.setIce("failed");
      await vi.advanceTimersByTimeAsync(DISCONNECTED_RESTART_MS * 2);
      expect(pc.createOffer).not.toHaveBeenCalled();
    });

    it("mutes by disabling its track and telling the other side", async () => {
      const audio = fakeTrack("audio");
      const { controller } = setup({ role: "LEARNER" }, fakeStream([audio]));
      const socket = await started(controller);
      socket.receive({ type: "welcome", role: "LEARNER", peerPresent: true, expiresAt: "x" });
      controller.toggleAudio();
      expect(audio.enabled).toBe(false);
      expect(controller.getState().localAudio).toBe(false);
      expect(socket.sent).toContainEqual({
        type: "media-state",
        audio: false,
        video: false,
        screen: false,
      });
    });

    it("only leaves on hangup", async () => {
      const { controller } = setup({ role: "LEARNER" });
      const socket = await started(controller);
      socket.receive({ type: "welcome", role: "LEARNER", peerPresent: true, expiresAt: "x" });
      controller.hangup();
      expect(socket.types()).toContain("hangup");
      expect(controller.getState()).toMatchObject({ phase: "ended", endedReason: "left" });
    });
  });

  it("a guardian adds no tracks, so its answer is receive-only", async () => {
    const { controller } = setup(
      { role: "GUARDIAN" },
      fakeStream([fakeTrack("audio"), fakeTrack("video")]),
    );
    const socket = await started(controller);
    socket.receive({ type: "welcome", role: "GUARDIAN", peerPresent: true, expiresAt: "x" });
    socket.receive({ type: "offer", sdp: "offer-sdp" });
    await flush();
    const pc = FakePeerConnection.latest();
    expect(pc.addTrack).not.toHaveBeenCalled();
    expect(socket.sent).toContainEqual({ type: "answer", sdp: "answer-sdp" });
    expect(controller.getState()).toMatchObject({ localAudio: false, localVideo: false });
  });

  it("closes the peer connection when the server ends the call", async () => {
    const { controller } = setup({ role: "LEARNER" });
    const socket = await started(controller);
    socket.receive({ type: "welcome", role: "LEARNER", peerPresent: true, expiresAt: "x" });
    const pc = FakePeerConnection.latest();
    socket.receive({ type: "session-ending", minutesLeft: 5 });
    expect(controller.getState().endingMinutes).toBe(5);
    socket.receive({ type: "ended", reason: "window-closed" });
    expect(pc.close).toHaveBeenCalled();
    expect(socket.closedWith).toBe(1000);
    expect(controller.getState()).toMatchObject({ phase: "ended", endedReason: "window-closed" });
  });

  it("keeps media up and reconnects with a fresh ticket when the socket drops", async () => {
    const { controller, join } = setup({ role: "LEARNER" });
    const socket = await started(controller);
    socket.receive({ type: "welcome", role: "LEARNER", peerPresent: true, expiresAt: "x" });
    const pc = FakePeerConnection.latest();
    socket.drop(1006);
    expect(controller.getState().reconnecting).toBe(true);
    expect(pc.close).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1_000);
    expect(join).toHaveBeenCalledWith("o1");
    const next = FakeSocket.latest();
    expect(next).not.toBe(socket);
    next.open();
    expect(next.sent[0]).toEqual({ type: "hello", ticket: "ticket-2" });
    next.receive({ type: "welcome", role: "LEARNER", peerPresent: true, expiresAt: "x" });
    expect(controller.getState().reconnecting).toBe(false);
  });

  it("stops reconnecting once the API refuses the join", async () => {
    const { controller } = setup({ role: "LEARNER" }, null, async () => {
      throw new ApiError(422, "This session isn't open for joining.");
    });
    const socket = await started(controller);
    socket.receive({ type: "welcome", role: "LEARNER", peerPresent: false, expiresAt: "x" });
    socket.drop(1006);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(controller.getState()).toMatchObject({ phase: "ended", endedReason: "unavailable" });
  });

  it("is refused when the same user joins from another tab", async () => {
    const { controller, join } = setup({ role: "LEARNER" });
    const socket = await started(controller);
    socket.receive({ type: "welcome", role: "LEARNER", peerPresent: false, expiresAt: "x" });
    socket.drop(4410);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(join).not.toHaveBeenCalled();
    expect(controller.getState()).toMatchObject({ phase: "refused", refusal: "replaced" });
  });

  it("is refused when the room is full", async () => {
    const { controller } = setup({ role: "LEARNER" });
    const socket = await started(controller);
    socket.receive({ type: "error", code: "room-full" });
    socket.drop(4409);
    expect(controller.getState()).toMatchObject({ phase: "refused", refusal: "full" });
  });
});

describe("analyzeStats", () => {
  function report(stats: Record<string, unknown>[]): RTCStatsReport {
    return new Map(stats.map((stat) => [stat.id as string, stat])) as unknown as RTCStatsReport;
  }

  it("says relayed when the selected pair goes through TURN", () => {
    const sample = analyzeStats(
      report([
        { id: "t", type: "transport", selectedCandidatePairId: "p" },
        {
          id: "p",
          type: "candidate-pair",
          localCandidateId: "l",
          remoteCandidateId: "r",
          currentRoundTripTime: 0.08,
        },
        { id: "l", type: "local-candidate", candidateType: "relay" },
        { id: "r", type: "remote-candidate", candidateType: "srflx" },
        { id: "v", type: "inbound-rtp", kind: "video", packetsLost: 3, packetsReceived: 97 },
      ]),
    );
    expect(sample).toEqual({
      path: "relay",
      rttSeconds: 0.08,
      packetsLost: 3,
      packetsReceived: 97,
    });
  });

  it("finds a nominated pair when there's no transport stat, and says direct", () => {
    const sample = analyzeStats(
      report([
        {
          id: "p",
          type: "candidate-pair",
          nominated: true,
          state: "succeeded",
          localCandidateId: "l",
          remoteCandidateId: "r",
        },
        { id: "l", type: "local-candidate", candidateType: "host" },
        { id: "r", type: "remote-candidate", candidateType: "srflx" },
      ]),
    );
    expect(sample.path).toBe("direct");
  });

  it("says nothing before a pair is selected", () => {
    expect(analyzeStats(report([])).path).toBeNull();
  });
});

describe("DirectCallController screen share", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    FakeSocket.instances = [];
    FakePeerConnection.instances = [];
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  /** A creator in a call with a learner, sending `tracks`, whose picker hands back `screen`. */
  async function sharingCreator(tracks: MediaStreamTrack[], screen = fakeTrack("video")) {
    const display = fakeStream([screen]);
    const getDisplayMedia = vi.fn(async () => display);
    const { controller } = setup(
      { role: "CREATOR" },
      fakeStream(tracks),
      undefined,
      getDisplayMedia,
    );
    const socket = await started(controller);
    socket.receive({ type: "welcome", role: "CREATOR", peerPresent: true, expiresAt: "x" });
    await flush();
    const pc = FakePeerConnection.latest();
    socket.receive({ type: "answer", sdp: "answer-sdp" });
    await flush();
    return { controller, socket, pc, screen, display, getDisplayMedia };
  }

  it("sends the screen in the camera's place and switches the camera off", async () => {
    const camera = fakeTrack("video");
    const { controller, socket, pc, screen, display } = await sharingCreator([
      fakeTrack("audio"),
      camera,
    ]);
    const sender = pc.senders.find((candidate) => candidate.track === camera)!;

    await controller.startScreenShare();

    expect(sender.replaceTrack).toHaveBeenCalledWith(screen);
    expect(camera.enabled).toBe(false);
    expect(pc.createOffer).toHaveBeenCalledTimes(1); // no renegotiation needed
    expect(controller.getState()).toMatchObject({
      screenSharing: true,
      screenStream: display,
      localVideo: false,
    });
    expect(socket.sent).toContainEqual({
      type: "media-state",
      audio: true,
      video: true,
      screen: true,
    });
  });

  it("keeps the camera off while sharing", async () => {
    const camera = fakeTrack("video");
    const { controller } = await sharingCreator([camera]);
    await controller.startScreenShare();
    controller.toggleVideo();
    expect(camera.enabled).toBe(false);
    expect(controller.getState().localVideo).toBe(false);
  });

  it("puts the camera back as it was when sharing stops", async () => {
    const camera = fakeTrack("video");
    const { controller, socket, pc, screen } = await sharingCreator([fakeTrack("audio"), camera]);
    const sender = pc.senders.find((candidate) => candidate.track === camera)!;
    await controller.startScreenShare();

    await controller.stopScreenShare();

    expect(sender.replaceTrack).toHaveBeenLastCalledWith(camera);
    expect(camera.enabled).toBe(true);
    expect(screen.stop).toHaveBeenCalled();
    expect(controller.getState()).toMatchObject({
      screenSharing: false,
      screenStream: null,
      localVideo: true,
    });
    expect(socket.sent[socket.sent.length - 1]).toEqual({
      type: "media-state",
      audio: true,
      video: true,
      screen: false,
    });
  });

  it("leaves a camera that was off, off, when sharing stops", async () => {
    const camera = fakeTrack("video");
    const { controller } = await sharingCreator([camera]);
    controller.toggleVideo();
    await controller.startScreenShare();
    await controller.stopScreenShare();
    expect(camera.enabled).toBe(false);
    expect(controller.getState().localVideo).toBe(false);
  });

  it("stops sharing when the browser's own stop button ends the track", async () => {
    const { controller, screen } = await sharingCreator([fakeTrack("video")]);
    await controller.startScreenShare();
    (screen.onended as () => void)();
    await flush();
    expect(controller.getState().screenSharing).toBe(false);
    expect(screen.stop).toHaveBeenCalled();
  });

  it("adds the screen and offers again when the tutor joined microphone-only", async () => {
    const { controller, pc, screen } = await sharingCreator([fakeTrack("audio")]);
    await controller.startScreenShare();
    await flush();
    expect(pc.addTrack).toHaveBeenLastCalledWith(screen, expect.anything());
    expect(pc.createOffer).toHaveBeenCalledTimes(2);

    // Stopping takes it off the wire again.
    pc.signalingState = "stable";
    await controller.stopScreenShare();
    await flush();
    expect(pc.senders.some((sender) => sender.track === screen)).toBe(false);
    expect(pc.createOffer).toHaveBeenCalledTimes(3);
  });

  it("sends the screen, not the camera, to a learner who rejoins mid-share", async () => {
    const camera = fakeTrack("video");
    const { controller, socket, screen } = await sharingCreator([fakeTrack("audio"), camera]);
    await controller.startScreenShare();

    socket.receive({ type: "peer-joined", role: "LEARNER", name: "Grace Hopper" });
    await flush();

    const fresh = FakePeerConnection.latest();
    const sent = fresh.addTrack.mock.calls.map(([track]) => track);
    expect(sent).toContain(screen);
    expect(sent).not.toContain(camera);
  });

  it("changes nothing when the picker is cancelled", async () => {
    const camera = fakeTrack("video");
    const getDisplayMedia = vi.fn(async () => {
      throw Object.assign(new Error("cancelled"), { name: "NotAllowedError" });
    });
    const { controller } = setup(
      { role: "CREATOR" },
      fakeStream([camera]),
      undefined,
      getDisplayMedia,
    );
    await started(controller);
    await controller.startScreenShare();
    expect(camera.enabled).toBe(true);
    expect(controller.getState()).toMatchObject({ screenSharing: false, localVideo: true });
  });

  it("is the tutor's alone", async () => {
    const getDisplayMedia = vi.fn(async () => fakeStream([fakeTrack("video")]));
    const { controller } = setup(
      { role: "LEARNER" },
      fakeStream([fakeTrack("video")]),
      undefined,
      getDisplayMedia,
    );
    await started(controller);
    await controller.startScreenShare();
    expect(getDisplayMedia).not.toHaveBeenCalled();
    expect(controller.getState().screenSharing).toBe(false);
  });

  it("stops the screen track when the call ends", async () => {
    const { controller, screen } = await sharingCreator([fakeTrack("video")]);
    await controller.startScreenShare();
    controller.hangup();
    expect(screen.stop).toHaveBeenCalled();
    expect(controller.getState()).toMatchObject({ phase: "ended", screenSharing: false });
  });

  it("shows when the other side is sharing", async () => {
    const { controller } = setup({ role: "LEARNER" });
    const socket = await started(controller);
    socket.receive({ type: "welcome", role: "LEARNER", peerPresent: true, expiresAt: "x" });
    socket.receive({ type: "media-state", audio: true, video: true, screen: true });
    expect(controller.getState().peerMedia).toEqual({ audio: true, video: true, screen: true });
  });
});

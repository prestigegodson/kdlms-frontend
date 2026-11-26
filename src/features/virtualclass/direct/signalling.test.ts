import { describe, expect, it, vi } from "vitest";
import {
  closeKind,
  parseSignal,
  SignallingClient,
  socketUrl,
  type WebSocketFactory,
} from "./signalling";
import { FakeSocket } from "./testFakes";

describe("parseSignal", () => {
  it("reads the server's frames", () => {
    expect(
      parseSignal('{"type":"welcome","role":"CREATOR","peerPresent":true,"expiresAt":"x"}'),
    ).toEqual({
      type: "welcome",
      role: "CREATOR",
      peerPresent: true,
      expiresAt: "x",
    });
    expect(
      parseSignal('{"type":"ice","candidate":null,"sdpMid":null,"sdpMLineIndex":null}'),
    ).toEqual({
      type: "ice",
      candidate: null,
      sdpMid: null,
      sdpMLineIndex: null,
    });
    expect(parseSignal('{"type":"media-state","audio":true,"video":true,"screen":true}')).toEqual({
      type: "media-state",
      audio: true,
      video: true,
      screen: true,
    });
    // An older peer leaves `screen` out.
    expect(parseSignal('{"type":"media-state","audio":false,"video":true}')).toEqual({
      type: "media-state",
      audio: false,
      video: true,
      screen: false,
    });
    expect(parseSignal('{"type":"session-ending","minutesLeft":5}')).toEqual({
      type: "session-ending",
      minutesLeft: 5,
    });
  });

  it("drops malformed frames and types outside the closed set", () => {
    expect(parseSignal("not json")).toBeNull();
    expect(parseSignal('"offer"')).toBeNull();
    expect(parseSignal('{"type":"offer"}')).toBeNull();
    expect(parseSignal('{"type":"media-state","audio":"yes","video":true}')).toBeNull();
    expect(parseSignal('{"type":"chat","text":"hi"}')).toBeNull();
  });
});

describe("closeKind", () => {
  it("maps the hub's close codes", () => {
    expect(closeKind(4000)).toBe("ended");
    expect(closeKind(4401)).toBe("refused");
    expect(closeKind(4403)).toBe("refused");
    expect(closeKind(4409)).toBe("full");
    expect(closeKind(4410)).toBe("replaced");
    expect(closeKind(1006)).toBe("dropped");
    expect(closeKind(1001)).toBe("dropped");
  });
});

describe("socketUrl", () => {
  it("builds a same-origin socket URL with no credentials in it", () => {
    expect(socketUrl("/ws/rtc", { protocol: "https:", host: "app.test" }, "")).toBe(
      "wss://app.test/ws/rtc",
    );
    expect(socketUrl("/ws/rtc", { protocol: "http:", host: "localhost:5173" }, "")).toBe(
      "ws://localhost:5173/ws/rtc",
    );
  });

  it("follows a cross-origin API base, as production's app/api split needs", () => {
    const page = { protocol: "https:", host: "app.kdlms.com" };
    expect(socketUrl("/ws/rtc", page, "https://api.kdlms.com")).toBe(
      "wss://api.kdlms.com/ws/rtc",
    );
    expect(socketUrl("/ws/rtc", page, "https://api.kdlms.com/")).toBe(
      "wss://api.kdlms.com/ws/rtc",
    );
    expect(socketUrl("ws/rtc", page, "http://localhost:8080")).toBe(
      "ws://localhost:8080/ws/rtc",
    );
  });

  it("leaves an already-absolute socket URL alone", () => {
    expect(
      socketUrl("wss://rtc.example/ws/rtc", { protocol: "https:", host: "a" }, "https://api.b"),
    ).toBe("wss://rtc.example/ws/rtc");
  });
});

describe("SignallingClient", () => {
  function connect() {
    const onMessage = vi.fn();
    const onClose = vi.fn();
    const client = new SignallingClient(
      "ws://app.test/ws/rtc",
      "ticket-1",
      { onMessage, onClose },
      FakeSocket as unknown as WebSocketFactory,
    );
    client.connect();
    return { client, socket: FakeSocket.latest(), onMessage, onClose };
  }

  it("says hello with the ticket as its first frame", () => {
    const { socket } = connect();
    expect(socket.url).toBe("ws://app.test/ws/rtc");
    socket.open();
    expect(socket.sent).toEqual([{ type: "hello", ticket: "ticket-1" }]);
  });

  it("answers the server's ping itself", () => {
    const { socket, onMessage } = connect();
    socket.open();
    socket.receive({ type: "ping" });
    expect(socket.sent[1]).toEqual({ type: "pong" });
    expect(onMessage).not.toHaveBeenCalled();
  });

  it("passes on valid frames and ignores the rest", () => {
    const { socket, onMessage } = connect();
    socket.open();
    socket.receive({ type: "peer-joined", role: "LEARNER", name: "Ada" });
    socket.receive({ type: "nonsense" });
    expect(onMessage).toHaveBeenCalledTimes(1);
    expect(onMessage).toHaveBeenCalledWith({ type: "peer-joined", role: "LEARNER", name: "Ada" });
  });

  it("reports a close it didn't ask for, but not its own", () => {
    const first = connect();
    first.socket.open();
    first.socket.drop(1006);
    expect(first.onClose).toHaveBeenCalledWith(1006);

    const second = connect();
    second.socket.open();
    second.client.close();
    second.socket.drop(1000);
    expect(second.onClose).not.toHaveBeenCalled();
  });
});

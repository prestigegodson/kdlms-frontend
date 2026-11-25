import { render, renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode } from "react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { JoinView } from "@/api/liveSessions";
import type { CallDeps } from "./callController";
import { DirectCallPage } from "./DirectCallPage";
import { directSession, FakePeerConnection, FakeSocket, fakeStream, fakeTrack } from "./testFakes";
import { useDirectCall } from "./useDirectCall";

vi.mock("webrtc-adapter", () => ({}));

function mediaError(name: string) {
  return Object.assign(new Error(name), { name });
}

function stubMediaDevices(
  getUserMedia: (constraints: MediaStreamConstraints) => Promise<MediaStream>,
) {
  const devices = {
    getUserMedia: vi.fn(getUserMedia),
    enumerateDevices: vi.fn(async () => [] as MediaDeviceInfo[]),
  };
  Object.defineProperty(navigator, "mediaDevices", { value: devices, configurable: true });
  return devices;
}

function renderPage(session: JoinView) {
  const router = createMemoryRouter(
    [
      {
        path: "/live/:occurrenceId",
        element: <DirectCallPage session={session} home="/learner" />,
      },
    ],
    { initialEntries: ["/live/o1"] },
  );
  render(<RouterProvider router={router} />);
}

describe("DirectCallPage", () => {
  afterEach(() => {
    Reflect.deleteProperty(navigator, "mediaDevices");
  });

  it("asks an in-app browser to open the link in Safari or Chrome", async () => {
    Reflect.deleteProperty(navigator, "mediaDevices");
    renderPage(directSession({ role: "LEARNER" }));

    expect(await screen.findByText("Open this link in Safari or Chrome")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Copy link/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Join call/ })).not.toBeInTheDocument();
  });

  it("explains how to unblock a denied camera and microphone", async () => {
    stubMediaDevices(async () => {
      throw mediaError("NotAllowedError");
    });
    renderPage(directSession({ role: "LEARNER" }));

    expect(await screen.findByText("Camera and microphone are blocked")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("joins with the microphone alone when there's no camera", async () => {
    const devices = stubMediaDevices(async (constraints) => {
      if (constraints.video) throw mediaError("NotFoundError");
      return fakeStream([fakeTrack("audio")]);
    });
    renderPage(directSession({ role: "LEARNER" }));

    expect(await screen.findByText("No camera found")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Join call/ })).toBeEnabled();
    expect(devices.getUserMedia).toHaveBeenLastCalledWith({ audio: true });
  });

  it("offers a listen-only join when there's no camera or microphone", async () => {
    stubMediaDevices(async () => {
      throw mediaError("NotFoundError");
    });
    renderPage(directSession({ role: "LEARNER" }));

    expect(await screen.findByText("No camera or microphone found")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Join to listen only/ })).toBeEnabled();
  });

  it("lets a guardian watch without a device check", async () => {
    const devices = stubMediaDevices(async () => fakeStream([]));
    renderPage(directSession({ role: "GUARDIAN" }));

    expect(await screen.findByRole("button", { name: /Watch lesson/ })).toBeInTheDocument();
    expect(devices.getUserMedia).not.toHaveBeenCalled();
  });

  it("shows the waiting screen once joined", async () => {
    stubMediaDevices(async () => fakeStream([fakeTrack("audio")]));
    vi.stubGlobal("WebSocket", FakeSocket);
    vi.stubGlobal("RTCPeerConnection", FakePeerConnection);
    try {
      renderPage(directSession({ role: "LEARNER", peerName: "Mr Okafor" }));
      await userEvent.click(await screen.findByRole("button", { name: /Join call/ }));
      const socket = await vi.waitFor(() => {
        expect(FakeSocket.instances.length).toBeGreaterThan(0);
        return FakeSocket.latest();
      });
      socket.open();
      socket.receive({ type: "welcome", role: "LEARNER", peerPresent: false, expiresAt: "x" });

      expect(await screen.findByText("Waiting for Mr Okafor to join…")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Leave" })).toBeInTheDocument();
    } finally {
      vi.unstubAllGlobals();
      FakeSocket.instances = [];
    }
  });

  describe("screen share", () => {
    /** Joins the call as `role`; `display` adds `getDisplayMedia` to the stubbed devices. */
    async function joinCall(role: JoinView["role"], display: boolean) {
      const devices = stubMediaDevices(async () =>
        fakeStream([fakeTrack("audio"), fakeTrack("video")]),
      );
      if (display) {
        Object.assign(devices, {
          getDisplayMedia: vi.fn(async () => fakeStream([fakeTrack("video")])),
        });
      }
      vi.stubGlobal("WebSocket", FakeSocket);
      vi.stubGlobal("RTCPeerConnection", FakePeerConnection);
      renderPage(directSession({ role }));
      await userEvent.click(await screen.findByRole("button", { name: /Join call/ }));
      return devices as typeof devices & { getDisplayMedia?: ReturnType<typeof vi.fn> };
    }

    afterEach(() => {
      vi.unstubAllGlobals();
      FakeSocket.instances = [];
    });

    it("lets the tutor share their screen, switching the camera off", async () => {
      const devices = await joinCall("CREATOR", true);
      await userEvent.click(await screen.findByRole("button", { name: "Share your screen" }));

      expect(devices.getDisplayMedia).toHaveBeenCalled();
      expect(
        await screen.findByRole("button", { name: "Stop sharing your screen" }),
      ).toBeInTheDocument();
      expect(screen.getByText("You're sharing your screen")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Camera is off while you share your screen" }),
      ).toBeDisabled();
    });

    it("shows the tutor's shared screen full-size, with the learner moved to the small box", async () => {
      await joinCall("CREATOR", true);
      expect(await screen.findByLabelText("Your video")).toBeInTheDocument();
      expect(screen.getByTestId("peer-view")).toHaveClass("inset-0");

      await userEvent.click(await screen.findByRole("button", { name: "Share your screen" }));

      const shared = await screen.findByLabelText("Your shared screen");
      expect(shared).toHaveClass("h-full", "w-full", "object-contain");
      expect(shared.parentElement).toBe(screen.getByRole("main"));
      expect(screen.getByTestId("peer-view")).toHaveClass("bottom-3", "right-3");
      expect(screen.queryByLabelText("Your video")).not.toBeInTheDocument();

      await userEvent.click(screen.getByRole("button", { name: "Stop sharing your screen" }));

      expect(await screen.findByLabelText("Your video")).toBeInTheDocument();
      expect(screen.queryByLabelText("Your shared screen")).not.toBeInTheDocument();
      expect(screen.getByTestId("peer-view")).toHaveClass("inset-0");
    });

    it("has no share button where the browser can't share a screen", async () => {
      await joinCall("CREATOR", false);
      expect(await screen.findByRole("button", { name: "Turn camera off" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Share your screen" })).not.toBeInTheDocument();
    });

    it("has no share button for a learner", async () => {
      await joinCall("LEARNER", true);
      expect(await screen.findByRole("button", { name: "Turn camera off" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Share your screen" })).not.toBeInTheDocument();
    });
  });
});

describe("useDirectCall", () => {
  it("opens one socket under StrictMode's double mount, spending the ticket once", async () => {
    FakeSocket.instances = [];
    const deps: Partial<CallDeps> = {
      WebSocket: FakeSocket as unknown as CallDeps["WebSocket"],
      RTCPeerConnection: FakePeerConnection as unknown as typeof RTCPeerConnection,
      events: null,
    };
    const { result, unmount } = renderHook(() => useDirectCall(directSession(), null, deps), {
      wrapper: StrictMode,
    });
    await vi.waitFor(() => expect(FakeSocket.instances).toHaveLength(1));
    expect(result.current.state.phase).toBe("connecting");
    unmount();
    expect(FakeSocket.latest().closedWith).toBe(1000);
  });
});

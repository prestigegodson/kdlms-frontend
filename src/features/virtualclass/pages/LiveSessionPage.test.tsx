import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/api/client";
import * as liveSessionsApi from "@/api/liveSessions";
import type { JoinView, ParticipantRole } from "@/api/liveSessions";
import type { Role } from "@/api/types";
import { resetAuthStore, useAuthStore } from "@/stores/authStore";
import { LiveSessionPage } from "./LiveSessionPage";

vi.mock("@livekit/components-styles", () => ({}));
vi.mock("@livekit/components-react", () => ({
  LiveKitRoom: ({
    children,
    token,
    audio,
    onDisconnected,
  }: {
    children: React.ReactNode;
    token: string;
    audio: unknown;
    onDisconnected: (reason?: number) => void;
  }) => (
    <div data-testid="room" data-token={token} data-audio={String(Boolean(audio))}>
      {/* Stands in for LiveKit closing the room under the participant (DisconnectReason.ROOM_DELETED = 5). */}
      <button type="button" onClick={() => onDisconnected(5)}>
        Simulate room closed
      </button>
      {children}
    </div>
  ),
  VideoConference: () => <p>Video conference</p>,
  // Mirrors the real PreJoin: the join button stays disabled until validation passes, and with no
  // onValidate the default rule demands a non-empty username.
  PreJoin: ({
    joinLabel,
    onSubmit,
    onValidate,
  }: {
    joinLabel: string;
    onSubmit: (values: unknown) => void;
    onValidate?: (values: { username: string }) => boolean;
  }) => {
    const values = { videoEnabled: true, audioEnabled: true, videoDeviceId: "", audioDeviceId: "", username: "" };
    const valid = onValidate ? onValidate(values) : values.username !== "";
    return (
      <button type="button" disabled={!valid} onClick={() => onSubmit(values)}>
        {joinLabel}
      </button>
    );
  },
  useDataChannel: vi.fn(),
}));
vi.mock("@/api/liveSessions", async () => ({
  ...(await vi.importActual<typeof import("@/api/liveSessions")>("@/api/liveSessions")),
  joinLiveSession: vi.fn(),
  endLiveSession: vi.fn(),
}));

function joinView(role: ParticipantRole): JoinView {
  return {
    occurrenceId: "o1",
    className: "Algebra",
    scheduledStart: "2026-10-05T08:00:00Z",
    scheduledEnd: "2026-10-05T09:00:00Z",
    serverUrl: "wss://livekit.test",
    token: "lk-token",
    roomName: "vc-o1",
    role,
    expiresAt: "2026-10-05T09:15:00Z",
  };
}

function renderAs(role: Role) {
  resetAuthStore();
  useAuthStore.setState({
    user: { id: "user-1", email: "user@example.com", firstName: "A", lastName: "B", role },
    accessToken: "access",
    refreshToken: "refresh",
  });
  const router = createMemoryRouter(
    [
      { path: "/live/:occurrenceId", element: <LiveSessionPage /> },
      { path: "*", element: <p>Portal home</p> },
    ],
    { initialEntries: ["/live/o1"] },
  );
  render(<RouterProvider router={router} />);
}

describe("LiveSessionPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("checks devices, then joins the room with the server's token", async () => {
    vi.mocked(liveSessionsApi.joinLiveSession).mockResolvedValue(joinView("LEARNER"));
    renderAs("LEARNER");

    const join = screen.getByRole("button", { name: "Join session" });
    expect(join).toBeEnabled();
    await userEvent.click(join);

    const room = await screen.findByTestId("room");
    expect(room).toHaveAttribute("data-token", "lk-token");
    expect(room).toHaveAttribute("data-audio", "true");
    expect(screen.getByText("Video conference")).toBeInTheDocument();
    expect(liveSessionsApi.joinLiveSession).toHaveBeenCalledWith("o1");
  });

  it("lets a guardian watch without publishing", async () => {
    vi.mocked(liveSessionsApi.joinLiveSession).mockResolvedValue(joinView("GUARDIAN"));
    renderAs("GUARDIAN");

    expect(screen.queryByRole("button", { name: "Join session" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Watch session" }));

    const room = await screen.findByTestId("room");
    expect(room).toHaveAttribute("data-audio", "false");
    expect(screen.getByText("Watching")).toBeInTheDocument();
  });

  it("lets only the creator end the session for everyone, after confirming", async () => {
    vi.mocked(liveSessionsApi.joinLiveSession).mockResolvedValue(joinView("CREATOR"));
    vi.mocked(liveSessionsApi.endLiveSession).mockResolvedValue(undefined);
    renderAs("CREATOR");
    await userEvent.click(screen.getByRole("button", { name: "Join session" }));
    await screen.findByTestId("room");

    await userEvent.click(screen.getByRole("button", { name: "End for everyone" }));
    expect(screen.getByText("End session for everyone?")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(liveSessionsApi.endLiveSession).not.toHaveBeenCalled();
    expect(screen.queryByText("End session for everyone?")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "End for everyone" }));
    await userEvent.click(screen.getByRole("button", { name: "End session" }));
    expect(liveSessionsApi.endLiveSession).toHaveBeenCalledWith("o1");
    expect(await screen.findByText("Portal home")).toBeInTheDocument();
  });

  it("doesn't offer learners or guardians the end-for-everyone action", async () => {
    vi.mocked(liveSessionsApi.joinLiveSession).mockResolvedValue(joinView("LEARNER"));
    renderAs("LEARNER");
    await userEvent.click(screen.getByRole("button", { name: "Join session" }));
    await screen.findByTestId("room");
    expect(screen.queryByRole("button", { name: "End for everyone" })).not.toBeInTheDocument();
  });

  it("tells a participant the session has ended when the room closes under them", async () => {
    vi.mocked(liveSessionsApi.joinLiveSession).mockResolvedValue(joinView("GUARDIAN"));
    renderAs("GUARDIAN");
    await userEvent.click(screen.getByRole("button", { name: "Watch session" }));
    expect(screen.queryByRole("button", { name: "End for everyone" })).not.toBeInTheDocument();

    await userEvent.click(await screen.findByRole("button", { name: "Simulate room closed" }));

    expect(screen.getByText("This session has ended.")).toBeInTheDocument();
    expect(screen.queryByTestId("room")).not.toBeInTheDocument();
  });

  it("shows why the server refused the join", async () => {
    vi.mocked(liveSessionsApi.joinLiveSession).mockRejectedValue(
      new ApiError(422, "This session was cancelled."),
    );
    renderAs("CREATOR");

    await userEvent.click(screen.getByRole("button", { name: "Join session" }));

    expect(await screen.findByText("This session was cancelled.")).toBeInTheDocument();
    expect(screen.queryByTestId("room")).not.toBeInTheDocument();
  });

  it("only reads the session-ending warning from the room's data messages", () => {
    const encode = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));
    expect(liveSessionsApi.parseSessionEnding(encode({ type: "session-ending", minutesLeft: 5 }))).toEqual({
      type: "session-ending",
      minutesLeft: 5,
    });
    expect(liveSessionsApi.parseSessionEnding(encode({ message: "hi" }))).toBeNull();
    expect(liveSessionsApi.parseSessionEnding(new TextEncoder().encode("not json"))).toBeNull();
  });
});

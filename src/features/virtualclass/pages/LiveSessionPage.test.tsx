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
  LiveKitRoom: ({ children, token, audio }: { children: React.ReactNode; token: string; audio: unknown }) => (
    <div data-testid="room" data-token={token} data-audio={String(Boolean(audio))}>
      {children}
    </div>
  ),
  VideoConference: () => <p>Video conference</p>,
  PreJoin: ({ joinLabel, onSubmit }: { joinLabel: string; onSubmit: (values: unknown) => void }) => (
    <button
      type="button"
      onClick={() =>
        onSubmit({ videoEnabled: true, audioEnabled: true, videoDeviceId: "", audioDeviceId: "", username: "" })
      }
    >
      {joinLabel}
    </button>
  ),
  useDataChannel: vi.fn(),
}));
vi.mock("@/api/liveSessions", async () => ({
  ...(await vi.importActual<typeof import("@/api/liveSessions")>("@/api/liveSessions")),
  joinLiveSession: vi.fn(),
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
  const router = createMemoryRouter([{ path: "/live/:occurrenceId", element: <LiveSessionPage /> }], {
    initialEntries: ["/live/o1"],
  });
  render(<RouterProvider router={router} />);
}

describe("LiveSessionPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("checks devices, then joins the room with the server's token", async () => {
    vi.mocked(liveSessionsApi.joinLiveSession).mockResolvedValue(joinView("LEARNER"));
    renderAs("LEARNER");

    await userEvent.click(screen.getByRole("button", { name: "Join session" }));

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

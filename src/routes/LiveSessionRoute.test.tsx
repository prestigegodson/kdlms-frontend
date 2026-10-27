import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/api/client";
import * as liveSessionsApi from "@/api/liveSessions";
import type { JoinView } from "@/api/liveSessions";
import { resetAuthStore, useAuthStore } from "@/stores/authStore";
import { LiveSessionRoute } from "./LiveSessionRoute";

vi.mock("@/api/liveSessions", async () => ({
  ...(await vi.importActual<typeof import("@/api/liveSessions")>("@/api/liveSessions")),
  joinLiveSession: vi.fn(),
  endLiveSession: vi.fn(),
}));
vi.mock("@/features/virtualclass/pages/LiveSessionPage", () => ({
  LiveSessionPage: () => <p>LiveKit room</p>,
}));

const external: JoinView = {
  occurrenceId: "o1",
  className: "Algebra",
  scheduledStart: "2026-10-05T08:00:00Z",
  scheduledEnd: "2026-10-05T09:00:00Z",
  serverUrl: null,
  token: null,
  roomName: null,
  role: "LEARNER",
  expiresAt: null,
  meetingMode: "EXTERNAL",
  meetingUrl: "https://zoom.us/j/123",
  meetingProvider: "ZOOM",
};

function renderRoute() {
  const router = createMemoryRouter([{ path: "/live/:occurrenceId", element: <LiveSessionRoute /> }], {
    initialEntries: ["/live/o1"],
  });
  render(<RouterProvider router={router} />);
}

describe("LiveSessionRoute", () => {
  beforeEach(() => {
    resetAuthStore();
    useAuthStore.setState({
      user: { id: "u1", email: "l@example.com", firstName: "L", lastName: "A", role: "LEARNER" },
      accessToken: "access",
      refreshToken: "refresh",
    });
    vi.mocked(liveSessionsApi.joinLiveSession).mockReset();
  });

  it("hands over an external session's link without loading the LiveKit room", async () => {
    vi.mocked(liveSessionsApi.joinLiveSession).mockResolvedValue(external);
    renderRoute();

    const link = await screen.findByRole("link", { name: /Open in Zoom/ });
    expect(link).toHaveAttribute("href", "https://zoom.us/j/123");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getByText("Your attendance has been recorded.")).toBeInTheDocument();
    expect(screen.queryByText("LiveKit room")).not.toBeInTheDocument();
  });

  it("opens the LiveKit room for a Platform Video Conferencing session", async () => {
    vi.mocked(liveSessionsApi.joinLiveSession).mockResolvedValue({
      ...external,
      serverUrl: "wss://livekit.test",
      token: "lk-token",
      roomName: "vc-o1",
      expiresAt: "2026-10-05T09:15:00Z",
      meetingMode: "PLATFORM",
      meetingUrl: null,
      meetingProvider: null,
    });
    renderRoute();

    expect(await screen.findByText("LiveKit room")).toBeInTheDocument();
  });

  it("says when the tutor hasn't provided a meeting link yet", async () => {
    vi.mocked(liveSessionsApi.joinLiveSession).mockRejectedValue(
      new ApiError(409, "The meeting link for this session hasn't been provided yet.", {
        type: liveSessionsApi.MEETING_LINK_REQUIRED_PROBLEM,
        title: "Meeting link required",
        status: 409,
        detail: "The meeting link for this session hasn't been provided yet.",
      }),
    );
    renderRoute();

    expect(await screen.findByText("The meeting link for this session hasn't been provided yet.")).toBeInTheDocument();
  });
});

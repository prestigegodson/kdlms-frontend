import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { type UpcomingItem, UpcomingSessionsPanel, type UpcomingSessions } from "./UpcomingSessionsPanel";

function session(overrides: Partial<UpcomingItem>): UpcomingItem {
  return {
    id: "o1",
    className: "Algebra",
    scheduledStart: "2099-10-05T08:00:00Z",
    scheduledEnd: "2099-10-05T09:00:00Z",
    status: "SCHEDULED",
    joinable: false,
    ...overrides,
  };
}

function renderPanel(load: () => Promise<UpcomingSessions>, hideWhenEmpty = false) {
  const router = createMemoryRouter(
    [
      {
        path: "/",
        element: (
          <UpcomingSessionsPanel
            load={load}
            joinLabel={(s) => (s.status === "LIVE" ? "Join" : "Start")}
            hideWhenEmpty={hideWhenEmpty}
          />
        ),
      },
      { path: "/live/:occurrenceId", element: <p>Live room</p> },
    ],
    { initialEntries: ["/"] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

describe("UpcomingSessionsPanel", () => {
  it("groups sessions by day in the given timezone with a live-room button for a joinable one", async () => {
    const router = renderPanel(() =>
      Promise.resolve({
        timezone: "Africa/Lagos",
        sessions: [
          session({ id: "o1", className: "Algebra", status: "LIVE", joinable: true }),
          session({
            id: "o2",
            className: "Geometry",
            status: "RESCHEDULED",
            detail: "Kemi Obi",
            scheduledStart: "2099-10-06T14:00:00Z",
            scheduledEnd: "2099-10-06T15:00:00Z",
          }),
        ],
      }),
    );

    expect(await screen.findByText("09:00–10:00 · Algebra")).toBeInTheDocument();
    expect(screen.getByText("15:00–16:00 · Geometry")).toBeInTheDocument();
    expect(screen.getByText("Kemi Obi")).toBeInTheDocument();
    expect(screen.getByText("Live")).toBeInTheDocument();
    expect(screen.getByText("Moved")).toBeInTheDocument();
    expect(screen.getByText("Times shown in Africa/Lagos.")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Join" })).toHaveLength(1);

    await userEvent.click(screen.getByRole("button", { name: "Join" }));
    expect(router.state.location.pathname).toBe("/live/o1");
  });

  it("says so when nothing is coming up", async () => {
    renderPanel(() => Promise.resolve({ sessions: [] }));

    expect(await screen.findByText("No sessions in the next 7 days.")).toBeInTheDocument();
  });

  it("renders nothing when asked to hide an empty list", async () => {
    const load = vi.fn(() => Promise.resolve({ sessions: [] }));
    renderPanel(load, true);

    await vi.waitFor(() => expect(load).toHaveBeenCalled());
    expect(screen.queryByText("Upcoming sessions")).not.toBeInTheDocument();
  });

  it("offers a retry when loading fails", async () => {
    renderPanel(() => Promise.reject(new Error("boom")));

    expect(await screen.findByText("We couldn't load your upcoming sessions.")).toBeInTheDocument();
  });
});

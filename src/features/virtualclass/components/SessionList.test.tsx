import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as liveSessionsApi from "@/api/liveSessions";
import type { Occurrence } from "@/api/virtualClasses";
import { SessionList } from "./SessionList";

vi.mock("@/api/liveSessions");

function occurrence(overrides: Partial<Occurrence>): Occurrence {
  return {
    id: "o1",
    classId: "c1",
    className: "Algebra",
    slotId: "s1",
    scheduledStart: "2099-10-05T08:00:00Z",
    scheduledEnd: "2099-10-05T09:00:00Z",
    originalStart: "2099-10-05T08:00:00Z",
    status: "SCHEDULED",
    cancelReason: null,
    overridden: false,
    editable: true,
    joinable: false,
    startedAt: null,
    endedAt: null,
    ...overrides,
  };
}

function renderList(occurrences: Occurrence[]) {
  const router = createMemoryRouter(
    [
      {
        path: "/",
        element: (
          <SessionList occurrences={occurrences} timezone="Africa/Lagos" emptyMessage="None" onChanged={() => {}} />
        ),
      },
      { path: "/live/:occurrenceId", element: <p>Live room</p> },
    ],
    { initialEntries: ["/"] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

describe("SessionList live sessions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("starts a joinable session in the live room", async () => {
    const router = renderList([occurrence({ joinable: true })]);

    await userEvent.click(screen.getByRole("button", { name: "Start" }));

    expect(router.state.location.pathname).toBe("/live/o1");
  });

  it("offers Join for a live session and no live-room button outside the window", () => {
    renderList([
      occurrence({ id: "o1", status: "LIVE", joinable: true, editable: false, startedAt: "2099-10-05T08:00:00Z" }),
      occurrence({ id: "o2", scheduledStart: "2099-10-06T08:00:00Z", scheduledEnd: "2099-10-06T09:00:00Z" }),
    ]);

    expect(screen.getAllByRole("button", { name: "Join" })).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "Start" })).not.toBeInTheDocument();
  });

  it("opens a started session's attendance", async () => {
    vi.mocked(liveSessionsApi.getOccurrenceAttendance).mockResolvedValue({
      occurrenceId: "o1",
      classId: "c1",
      className: "Algebra",
      scheduledStart: "2026-10-05T08:00:00Z",
      scheduledEnd: "2026-10-05T09:00:00Z",
      status: "ENDED",
      startedAt: "2026-10-05T08:00:00Z",
      endedAt: "2026-10-05T08:58:00Z",
      learners: [
        {
          learnerId: "l1",
          firstName: "Lola",
          lastName: "Ade",
          enrolled: true,
          present: true,
          minutes: 50,
          firstJoinedAt: "2026-10-05T08:02:00Z",
        },
        {
          learnerId: "l2",
          firstName: "Bayo",
          lastName: "Ade",
          enrolled: true,
          present: false,
          minutes: 0,
          firstJoinedAt: null,
        },
      ],
      observers: [{ userId: "g1", name: "Pat Parent", minutes: 20, firstJoinedAt: "2026-10-05T08:05:00Z" }],
    });
    renderList([
      occurrence({
        status: "ENDED",
        editable: false,
        scheduledStart: "2026-10-05T08:00:00Z",
        scheduledEnd: "2026-10-05T09:00:00Z",
        startedAt: "2026-10-05T08:00:00Z",
      }),
    ]);

    await userEvent.click(screen.getByRole("button", { name: /Actions for/ }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Attendance" }));

    expect(await screen.findByText("Lola Ade")).toBeInTheDocument();
    expect(screen.getByText("Absent")).toBeInTheDocument();
    expect(screen.getByText("Pat Parent · 20 min")).toBeInTheDocument();
    expect(liveSessionsApi.getOccurrenceAttendance).toHaveBeenCalledWith("o1");
  });
});

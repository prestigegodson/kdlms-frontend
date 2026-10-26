import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Occurrence } from "@/api/virtualClasses";
import { SessionsMonthCalendar } from "./SessionsMonthCalendar";

function occurrence(overrides: Partial<Occurrence>): Occurrence {
  return {
    id: "o1",
    classId: "c1",
    className: "Algebra",
    slotId: "s1",
    scheduledStart: "2026-10-21T08:00:00Z",
    scheduledEnd: "2026-10-21T09:00:00Z",
    originalStart: "2026-10-21T08:00:00Z",
    status: "SCHEDULED",
    cancelReason: null,
    overridden: false,
    editable: true,
    joinable: false,
    startedAt: null,
    endedAt: null,
    meetingMode: "PLATFORM",
    meetingUrl: null,
    meetingProvider: null,
    meetingOverridden: false,
    meetingUnavailable: false,
    ...overrides,
  };
}

const SESSIONS = [
  occurrence({ id: "o1" }),
  occurrence({
    id: "o2",
    className: "Geometry",
    scheduledStart: "2026-10-22T08:00:00Z",
    scheduledEnd: "2026-10-22T09:00:00Z",
    status: "CANCELLED",
    editable: false,
  }),
];

function renderCalendar(selectedDate = "2026-10-12") {
  const onSelectDate = vi.fn();
  const router = createMemoryRouter(
    [
      {
        path: "/",
        element: (
          <SessionsMonthCalendar
            month="2026-10"
            occurrences={SESSIONS}
            timezone="Africa/Lagos"
            selectedDate={selectedDate}
            onSelectDate={onSelectDate}
            onChanged={() => {}}
          />
        ),
      },
    ],
    { initialEntries: ["/"] },
  );
  render(<RouterProvider router={router} />);
  return onSelectDate;
}

describe("SessionsMonthCalendar", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-12T10:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("marks session days, cancelled-only days and today", () => {
    renderCalendar();

    expect(
      screen.getByRole("button", { name: "Wednesday 21 October, 1 session" }),
    ).toHaveAttribute("data-marker", "sessions");
    expect(
      screen.getByRole("button", { name: "Thursday 22 October, 1 session, all cancelled" }),
    ).toHaveAttribute("data-marker", "cancelled");
    const today = screen.getByRole("button", { name: "Monday 12 October, today, no sessions" });
    expect(today).toHaveAttribute("aria-pressed", "true");
    expect(today.querySelector("[data-testid='today-dot']")).not.toBeNull();
    // Sunday-first: the grid opens on the Sunday before 1 October.
    expect(screen.getAllByRole("button")[0]).toHaveAccessibleName(
      "Sunday 27 September, no sessions",
    );
  });

  it("lists the selected day's sessions and reports a day click", async () => {
    const user = userEvent.setup();
    const onSelectDate = renderCalendar("2026-10-21");

    expect(screen.getByRole("heading", { name: "Wednesday 21 October" })).toBeInTheDocument();
    expect(screen.getByText(/Algebra/)).toBeInTheDocument();
    expect(screen.queryByText(/Geometry/)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^Thursday 22 October/ }));
    expect(onSelectDate).toHaveBeenCalledWith("2026-10-22");
  });

  it("says so when the selected day has no sessions", () => {
    renderCalendar();
    expect(screen.getByText("No sessions on this day.")).toBeInTheDocument();
  });
});

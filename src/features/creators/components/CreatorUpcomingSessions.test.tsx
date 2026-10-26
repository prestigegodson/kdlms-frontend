import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as virtualClassesApi from "@/api/virtualClasses";
import type { Occurrence } from "@/api/virtualClasses";
import { addDays, dateInZone, longDate } from "@/features/virtualclass/scheduleUtils";
import { CreatorUpcomingSessions } from "./CreatorUpcomingSessions";

vi.mock("@/api/virtualClasses");

const today = dateInZone(new Date(), "UTC");
const tomorrow = addDays(today, 1);

function occurrence(id: string, date: string, overrides: Partial<Occurrence> = {}): Occurrence {
  return {
    id,
    classId: "c1",
    className: "Further Maths",
    slotId: null,
    scheduledStart: `${date}T23:00:00Z`,
    scheduledEnd: `${date}T23:45:00Z`,
    originalStart: `${date}T23:00:00Z`,
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

function renderPanel(occurrences: Occurrence[]) {
  vi.mocked(virtualClassesApi.listUpcomingOccurrences).mockResolvedValue({ timezone: "UTC", occurrences });
  return render(
    <MemoryRouter>
      <CreatorUpcomingSessions />
    </MemoryRouter>,
  );
}

describe("CreatorUpcomingSessions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("groups sessions by day behind a date tile, highlighting today", async () => {
    renderPanel([
      occurrence("a", today, { joinable: true }),
      occurrence("b", today, { status: "LIVE", joinable: true, className: "Physics" }),
      occurrence("c", tomorrow),
    ]);

    const todayGroup = await screen.findByRole("region", { name: longDate(today) });
    expect(within(todayGroup).getByTestId("date-tile")).toHaveAttribute("data-today", "true");
    expect(within(todayGroup).getByRole("button", { name: "Start session" })).toBeInTheDocument();
    expect(within(todayGroup).getByRole("button", { name: "Join" })).toBeInTheDocument();
    expect(within(todayGroup).getByText("FM")).toBeInTheDocument();
    expect(within(todayGroup).getAllByText(/45 min/)).toHaveLength(2);

    const tomorrowGroup = screen.getByRole("region", { name: longDate(tomorrow) });
    expect(within(tomorrowGroup).getByTestId("date-tile")).toHaveAttribute("data-today", "false");
    expect(within(tomorrowGroup).getByRole("button", { name: "View" })).toBeInTheDocument();
    expect(screen.getByText("You have 2 sessions today")).toBeInTheDocument();
  });

  it("filters the list to a day picked on the calendar, and clears it", async () => {
    const user = userEvent.setup();
    renderPanel([occurrence("a", today), occurrence("c", tomorrow)]);

    await screen.findByRole("region", { name: longDate(today) });
    await user.click(screen.getByRole("button", { name: `${longDate(tomorrow)}, 1 session` }));
    expect(screen.queryByRole("region", { name: longDate(today) })).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: longDate(tomorrow) })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /show all days/ }));
    expect(screen.getByRole("region", { name: longDate(today) })).toBeInTheDocument();
  });

  it("says when nothing is coming up", async () => {
    renderPanel([]);
    expect(await screen.findByText(/No sessions in the next 7 days\./)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous month" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next month" })).toBeDisabled();
  });

  it("offers a retry when loading fails", async () => {
    vi.mocked(virtualClassesApi.listUpcomingOccurrences).mockRejectedValue(new Error("boom"));
    render(
      <MemoryRouter>
        <CreatorUpcomingSessions />
      </MemoryRouter>,
    );
    expect(await screen.findByRole("button", { name: /retry|try again/i })).toBeInTheDocument();
  });
});

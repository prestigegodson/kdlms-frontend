import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as virtualClassesApi from "@/api/virtualClasses";
import type { Occurrence, VirtualClassList } from "@/api/virtualClasses";
import { SessionsCalendarPage } from "./SessionsCalendarPage";

vi.mock("@/api/virtualClasses", async () => {
  const actual =
    await vi.importActual<typeof import("@/api/virtualClasses")>("@/api/virtualClasses");
  return { ...actual, listVirtualClasses: vi.fn(), listOccurrences: vi.fn() };
});

const CLASSES: VirtualClassList = {
  classes: [
    {
      id: "c1",
      name: "Algebra",
      description: null,
      subjectLabel: null,
      status: "ACTIVE",
      startDate: "2026-09-01",
      endDate: null,
      overLimit: false,
      slots: [],
      createdAt: "2026-09-01T08:00:00Z",
    },
  ],
  maxClasses: null,
  activeCount: 1,
  timezone: "Africa/Lagos",
};

function occurrence(id: string, start: string, overrides: Partial<Occurrence> = {}): Occurrence {
  const end = new Date(Date.parse(start) + 3600_000).toISOString();
  return {
    id,
    classId: "c1",
    className: "Algebra",
    slotId: "s1",
    scheduledStart: start,
    scheduledEnd: end,
    originalStart: start,
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

function mockOccurrences(lookahead: Occurrence[], month: Occurrence[]) {
  vi.mocked(virtualClassesApi.listOccurrences).mockImplementation(async (from) => ({
    timezone: "Africa/Lagos",
    occurrences: from === "2026-10-12" ? lookahead : month,
  }));
}

function renderPage() {
  const router = createMemoryRouter(
    [{ path: "/creator/sessions", element: <SessionsCalendarPage /> }],
    { initialEntries: ["/creator/sessions"] },
  );
  render(<RouterProvider router={router} />);
}

describe("SessionsCalendarPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-12T10:00:00Z"));
    vi.mocked(virtualClassesApi.listVirtualClasses).mockResolvedValue(CLASSES);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("opens the calendar on the next upcoming session's month and day", async () => {
    const next = occurrence("o2", "2026-11-03T08:00:00Z");
    mockOccurrences(
      [occurrence("o1", "2026-10-20T08:00:00Z", { status: "CANCELLED", editable: false }), next],
      [next],
    );

    renderPage();

    expect(await screen.findByRole("heading", { name: "November 2026" })).toBeInTheDocument();
    expect(virtualClassesApi.listOccurrences).toHaveBeenCalledWith("2026-10-12", "2026-12-12");
    await waitFor(() =>
      expect(virtualClassesApi.listOccurrences).toHaveBeenCalledWith(
        "2026-11-01",
        "2026-12-05",
        undefined,
      ),
    );
    expect(
      await screen.findByRole("button", { name: "Tuesday 3 November, 1 session" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Calendar view" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("falls back to the current month when nothing is coming up", async () => {
    mockOccurrences([], []);

    renderPage();

    expect(await screen.findByRole("heading", { name: "October 2026" })).toBeInTheDocument();
    expect(
      await screen.findByRole("button", { name: "Monday 12 October, today, no sessions" }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("remembers the list view, which shows only the month's own sessions", async () => {
    const user = userEvent.setup();
    const inMonth = occurrence("o2", "2026-11-03T08:00:00Z");
    const trailing = occurrence("o3", "2026-12-01T08:00:00Z");
    mockOccurrences([inMonth], [inMonth, trailing]);

    renderPage();
    await user.click(await screen.findByRole("button", { name: "List view" }));

    expect(window.localStorage.getItem("kdlms.creatorSessions.view")).toBe("list");
    expect(await screen.findByRole("region", { name: "Tuesday 3 November" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Tuesday 1 December" })).not.toBeInTheDocument();
  });

  it("pages months and still renders when storage is blocked", async () => {
    const user = userEvent.setup();
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    mockOccurrences([], []);

    renderPage();
    await user.click(await screen.findByRole("button", { name: "Next month" }));

    expect(screen.getByRole("heading", { name: "November 2026" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Today" })).toBeInTheDocument();
    expect(
      await screen.findByRole("button", { name: "Sunday 1 November, no sessions" }),
    ).toHaveAttribute("aria-pressed", "true");
  });
});

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as wardsApi from "@/api/wards";
import { WardAttendancePage } from "@/features/guardian/WardAttendancePage";
import { resetAuthStore, useAuthStore } from "@/stores/authStore";
import { resetWardStore } from "@/stores/wardStore";
import { addDaysIso } from "@/utils/date";

vi.mock("@/api/wards", async () => {
  const actual = await vi.importActual<typeof import("@/api/wards")>("@/api/wards");
  return { ...actual, listMyWards: vi.fn(), getWardsWeekAttendance: vi.fn() };
});

const WARD = {
  studentId: "s1",
  fullName: "Ada Obi",
  admissionNumber: "SCH/2026/0001",
  relationship: "MOTHER",
  gender: "FEMALE" as const,
  currentClassName: "Primary 3",
  status: "ACTIVE",
  schoolId: "school-1",
  schoolName: "Bright Star Academy",
};

const WARD_2 = {
  studentId: "s2",
  fullName: "Bode Obi",
  admissionNumber: "SUN/2026/0007",
  relationship: "FATHER",
  gender: "MALE" as const,
  status: "ACTIVE",
  schoolId: "school-2",
  schoolName: "Sunrise Academy",
};

function renderPage() {
  resetAuthStore();
  useAuthStore.setState({
    user: {
      id: "guardian-1",
      email: "guardian@example.com",
      firstName: "Gina",
      lastName: "G",
      role: "GUARDIAN",
      schoolId: "school-1",
    },
    accessToken: "access",
    refreshToken: "refresh",
  });
  const router = createMemoryRouter(
    [
      { path: "/", element: <WardAttendancePage /> },
      { path: "/guardian/attendance/:studentId", element: <p>Ward attendance sessions page</p> },
    ],
    { initialEntries: ["/"] },
  );
  render(<RouterProvider router={router} />);
}

// Pinned to Wednesday 4 Nov 2026, so the current week is Mon 2 - Fri 6 Nov.
const NOW = new Date(2026, 10, 4, 10, 0, 0);

function week(weekStart: string, wards: wardsApi.WardWeek[]): wardsApi.WardWeekAttendanceView {
  return { weekStart, weekEnd: addDaysIso(weekStart, 4), wards };
}

describe("WardAttendancePage (weekly grid)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetWardStore();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    vi.mocked(wardsApi.getWardsWeekAttendance).mockResolvedValue(week("2026-11-02", []));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows an empty state when the guardian has no linked wards", async () => {
    vi.mocked(wardsApi.listMyWards).mockResolvedValue([]);

    renderPage();

    expect(await screen.findByText("No wards linked yet")).toBeInTheDocument();
    expect(wardsApi.getWardsWeekAttendance).not.toHaveBeenCalled();
  });

  it("shows a retryable error state when the ward list fails to load", async () => {
    vi.mocked(wardsApi.listMyWards).mockRejectedValueOnce(new Error("network down")).mockResolvedValue([WARD]);
    const user = userEvent.setup();

    renderPage();

    await user.click(await screen.findByRole("button", { name: "Try again" }));

    expect(await screen.findByText("Ada Obi")).toBeInTheDocument();
  });

  it("lists each ward with a mark per weekday for the current week", async () => {
    vi.mocked(wardsApi.listMyWards).mockResolvedValue([WARD]);
    vi.mocked(wardsApi.getWardsWeekAttendance).mockResolvedValue(
      week("2026-11-02", [
        {
          studentId: "s1",
          days: [
            { date: "2026-11-02", session: "MORNING", status: "PRESENT" },
            { date: "2026-11-03", session: "MORNING", status: "LATE" },
            { date: "2026-11-04", session: "MORNING", status: "ABSENT" },
          ],
        },
      ]),
    );

    renderPage();

    expect(await screen.findByRole("img", { name: "Mon 2 Nov: Present" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Tue 3 Nov: Late" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Wed 4 Nov: Absent" })).toBeInTheDocument();
    expect(screen.getByText("2 Nov – 6 Nov 2026")).toBeInTheDocument();
    expect(wardsApi.getWardsWeekAttendance).toHaveBeenCalledWith("2026-11-02");
  });

  it("labels each session's mark separately for a two-session school", async () => {
    vi.mocked(wardsApi.listMyWards).mockResolvedValue([WARD]);
    vi.mocked(wardsApi.getWardsWeekAttendance).mockResolvedValue(
      week("2026-11-02", [
        {
          studentId: "s1",
          days: [
            { date: "2026-11-02", session: "MORNING", status: "PRESENT" },
            { date: "2026-11-02", session: "AFTERNOON", status: "ABSENT" },
          ],
        },
      ]),
    );

    renderPage();

    expect(await screen.findByRole("img", { name: "Mon 2 Nov Morning: Present" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Mon 2 Nov Afternoon: Absent" })).toBeInTheDocument();
  });

  it("steps back a week with < and disables > on the current week", async () => {
    vi.mocked(wardsApi.listMyWards).mockResolvedValue([WARD]);
    vi.mocked(wardsApi.getWardsWeekAttendance).mockImplementation((weekStart) =>
      Promise.resolve(
        week(weekStart, [
          { studentId: "s1", days: [{ date: weekStart, session: "MORNING", status: "PRESENT" }] },
        ]),
      ),
    );
    const user = userEvent.setup();

    renderPage();

    await screen.findByRole("img", { name: "Mon 2 Nov: Present" });
    expect(screen.getByRole("button", { name: "Next week" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Previous week" }));

    expect(await screen.findByRole("img", { name: "Mon 26 Oct: Present" })).toBeInTheDocument();
    expect(wardsApi.getWardsWeekAttendance).toHaveBeenLastCalledWith("2026-10-26");
    expect(screen.getByText("26 Oct – 30 Oct 2026")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next week" })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "Next week" }));

    await waitFor(() => expect(wardsApi.getWardsWeekAttendance).toHaveBeenLastCalledWith("2026-11-02"));
    expect(screen.getByRole("button", { name: "Next week" })).toBeDisabled();
  });

  it("shows a retryable error when the week fails to load", async () => {
    vi.mocked(wardsApi.listMyWards).mockResolvedValue([WARD]);
    vi.mocked(wardsApi.getWardsWeekAttendance)
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValue(
        week("2026-11-02", [
          { studentId: "s1", days: [{ date: "2026-11-02", session: "MORNING", status: "PRESENT" }] },
        ]),
      );
    const user = userEvent.setup();

    renderPage();

    expect(await screen.findByText("Failed to load attendance")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByRole("img", { name: "Mon 2 Nov: Present" })).toBeInTheDocument();
    expect(screen.queryByText("Failed to load attendance")).not.toBeInTheDocument();
  });

  it("groups rows under school headings when the guardian has wards at more than one school", async () => {
    vi.mocked(wardsApi.listMyWards).mockResolvedValue([WARD, WARD_2]);

    renderPage();

    expect(await screen.findByText("Ada Obi")).toBeInTheDocument();
    expect(screen.getByText("Bode Obi")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Bright Star Academy" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Sunrise Academy" })).toBeInTheDocument();
  });

  it("opens the ward's term drill-down from the ward's name", async () => {
    vi.mocked(wardsApi.listMyWards).mockResolvedValue([WARD]);
    const user = userEvent.setup();

    renderPage();
    await user.click(await screen.findByRole("link", { name: "Ada Obi" }));

    expect(await screen.findByText("Ward attendance sessions page")).toBeInTheDocument();
  });
});

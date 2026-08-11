import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as wardsApi from "@/api/wards";
import { WardAttendanceLayout } from "@/features/guardian/WardAttendanceLayout";
import { WardAttendancePage } from "@/features/guardian/WardAttendancePage";
import { WardAttendanceSessionsPage } from "@/features/guardian/WardAttendanceSessionsPage";
import { WardAttendanceSessionTermsPage } from "@/features/guardian/WardAttendanceSessionTermsPage";
import { WardTermAttendancePage } from "@/features/guardian/WardTermAttendancePage";
import { resetAuthStore, useAuthStore } from "@/stores/authStore";
import { resetWardStore } from "@/stores/wardStore";

vi.mock("@/api/wards", async () => {
  const actual = await vi.importActual<typeof import("@/api/wards")>("@/api/wards");
  return { ...actual, listMyWards: vi.fn(), listWardTerms: vi.fn(), getWardAttendance: vi.fn() };
});

const WARD_A = {
  studentId: "s1",
  fullName: "Ada Obi",
  admissionNumber: "SCH/2026/0001",
  relationship: "MOTHER",
  gender: "FEMALE" as const,
  status: "ACTIVE",
  schoolId: "school-1",
  schoolName: "Bright Star Academy",
};

const TERM_1 = {
  sessionId: "sess-a",
  sessionName: "2026/2027",
  currentSession: true,
  termId: "term-1",
  termName: "First Term",
  termNumber: 1,
  classId: "class-a",
  className: "Primary 3",
  resultsPublished: true,
};

const TERM_2 = {
  sessionId: "sess-a",
  sessionName: "2026/2027",
  currentSession: true,
  termId: "term-2",
  termName: "Second Term",
  termNumber: 2,
  classId: "class-a",
  className: "Primary 3",
  resultsPublished: false,
};

const SUMMARY_1 = {
  studentId: "s1",
  studentName: "Ada Obi",
  admissionNumber: "SCH/2026/0001",
  termId: "term-1",
  present: 40,
  absent: 2,
  late: 1,
  excused: 0,
  daysMarked: 43,
  attendanceRate: 95.3,
  days: [{ date: "2026-09-01", status: "PRESENT" as const }],
};

const SUMMARY_2 = {
  studentId: "s1",
  studentName: "Ada Obi",
  admissionNumber: "SCH/2026/0001",
  termId: "term-2",
  present: 0,
  absent: 0,
  late: 0,
  excused: 0,
  daysMarked: 0,
  attendanceRate: 0,
  days: [],
};

function attendanceRouter(initialEntries: string[]) {
  return createMemoryRouter(
    [
      {
        path: "/guardian/attendance",
        children: [
          { index: true, element: <WardAttendancePage /> },
          {
            path: ":studentId",
            element: <WardAttendanceLayout />,
            children: [
              { index: true, element: <WardAttendanceSessionsPage /> },
              { path: ":sessionId", element: <WardAttendanceSessionTermsPage /> },
              { path: ":sessionId/:termId", element: <WardTermAttendancePage /> },
            ],
          },
        ],
      },
    ],
    { initialEntries },
  );
}

function signIn() {
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
}

describe("Guardian attendance drill-down (School -> Ward -> Session -> Term -> Summary)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetWardStore();
    vi.mocked(wardsApi.listMyWards).mockResolvedValue([WARD_A]);
    vi.mocked(wardsApi.listWardTerms).mockResolvedValue([TERM_1, TERM_2]);
    vi.mocked(wardsApi.getWardAttendance).mockImplementation((_studentId, termId) =>
      Promise.resolve(termId === "term-1" ? SUMMARY_1 : SUMMARY_2),
    );
  });

  it("walks ward down to a term's summary, showing rate badges along the way", async () => {
    const user = userEvent.setup();
    signIn();
    render(<RouterProvider router={attendanceRouter(["/guardian/attendance"])} />);

    // Step 1: pick the ward.
    await user.click(await screen.findByText("Ada Obi"));

    // Step 2: its one session, current.
    await screen.findByText("2026/2027");
    expect(screen.getByText("Current")).toBeInTheDocument();
    await user.click(screen.getByText("2026/2027"));

    // Step 3: both terms are tappable (not publication-gated); rate badges resolve.
    await screen.findByText("95.3%");
    expect(await screen.findByText("No register yet")).toBeInTheDocument();

    // Breadcrumb reflects the session level.
    expect(screen.getByRole("link", { name: "Bright Star Academy" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ada Obi" })).toBeInTheDocument();

    // Step 4: the summary for the term with a rate.
    await user.click(screen.getByText("First Term"));

    expect(await screen.findByText("Present")).toBeInTheDocument();
    expect(screen.getByText("95.3%")).toBeInTheDocument();
    expect(wardsApi.getWardAttendance).toHaveBeenCalledWith("s1", "term-1");
  });

  it("renders the summary directly on a deep link, without visiting earlier steps", async () => {
    signIn();
    render(<RouterProvider router={attendanceRouter(["/guardian/attendance/s1/sess-a/term-1"])} />);

    expect(await screen.findByText("Present")).toBeInTheDocument();
    expect(screen.getByText("95.3%")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Bright Star Academy" })).toBeInTheDocument();
    expect(screen.getByText("First Term")).toBeInTheDocument();
  });
});

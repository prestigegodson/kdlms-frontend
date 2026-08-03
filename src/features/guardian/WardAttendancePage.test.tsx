import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as wardsApi from "@/api/wards";
import { WardAttendancePage } from "@/features/guardian/WardAttendancePage";
import { resetAuthStore, useAuthStore } from "@/stores/authStore";
import { resetWardStore, useWardStore } from "@/stores/wardStore";

vi.mock("@/api/wards", async () => {
  const actual = await vi.importActual<typeof import("@/api/wards")>("@/api/wards");
  return { ...actual, listMyWards: vi.fn(), listWardTerms: vi.fn(), getWardAttendance: vi.fn() };
});

const WARD = {
  studentId: "s1",
  fullName: "Ada Obi",
  admissionNumber: "SCH/2026/0001",
  relationship: "MOTHER",
  gender: "FEMALE" as const,
  status: "ACTIVE",
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
  const router = createMemoryRouter([{ path: "/", element: <WardAttendancePage /> }], { initialEntries: ["/"] });
  render(<RouterProvider router={router} />);
}

describe("WardAttendancePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetWardStore();
    vi.mocked(wardsApi.listMyWards).mockResolvedValue([WARD]);
  });

  it("shows an empty state when the guardian has no linked wards", async () => {
    vi.mocked(wardsApi.listMyWards).mockResolvedValue([]);

    renderPage();

    expect(await screen.findByText("No wards linked yet")).toBeInTheDocument();
  });

  it("lists every term the ward has been enrolled for, including unpublished ones", async () => {
    vi.mocked(wardsApi.listWardTerms).mockResolvedValue([
      {
        sessionId: "sess-1",
        sessionName: "2026/2027",
        currentSession: true,
        termId: "term-1",
        termName: "First Term",
        termNumber: 1,
        classId: "class-1",
        resultsPublished: false,
      },
    ]);
    vi.mocked(wardsApi.getWardAttendance).mockResolvedValue({
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
      days: [{ date: "2026-09-01", status: "PRESENT" }],
    });

    renderPage();
    useWardStore.setState({ selectedWardId: "s1" });

    expect(await screen.findByText("95.3%")).toBeInTheDocument();
  });

  it("shows an empty state when the ward has no attendance recorded yet", async () => {
    vi.mocked(wardsApi.listWardTerms).mockResolvedValue([
      {
        sessionId: "sess-1",
        sessionName: "2026/2027",
        currentSession: true,
        termId: "term-1",
        termName: "First Term",
        termNumber: 1,
        classId: "class-1",
        resultsPublished: false,
      },
    ]);
    vi.mocked(wardsApi.getWardAttendance).mockResolvedValue({
      studentId: "s1",
      studentName: "Ada Obi",
      admissionNumber: "SCH/2026/0001",
      termId: "term-1",
      present: 0,
      absent: 0,
      late: 0,
      excused: 0,
      daysMarked: 0,
      attendanceRate: 0,
      days: [],
    });

    renderPage();
    useWardStore.setState({ selectedWardId: "s1" });

    expect(await screen.findByText("No attendance recorded")).toBeInTheDocument();
  });
});

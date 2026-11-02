import { render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as wardsApi from "@/api/wards";
import type { WardTermView } from "@/api/wards";
import { WardTimetablePage } from "@/features/guardian/WardTimetablePage";
import { resetAuthStore, useAuthStore } from "@/stores/authStore";
import { resetFeatureStore } from "@/stores/featureStore";
import { resetWardStore } from "@/stores/wardStore";

vi.mock("@/api/wards", async () => {
  const actual = await vi.importActual<typeof import("@/api/wards")>("@/api/wards");
  return {
    ...actual,
    listMyWards: vi.fn(),
    listWardTerms: vi.fn(),
    getWardTimetable: vi.fn(),
  };
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

function term(
  termNumber: number,
  name: string,
  overrides: Partial<WardTermView> = {},
): WardTermView {
  return {
    sessionId: "session-1",
    sessionName: "2026/2027",
    currentSession: true,
    termId: `term-${termNumber}`,
    termName: name,
    termNumber,
    classId: "class-1",
    className: "Primary 3",
    resultsPublished: false,
    midtermPublished: false,
    ...overrides,
  };
}

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
  const router = createMemoryRouter([{ path: "/", element: <WardTimetablePage /> }], {
    initialEntries: ["/"],
  });
  render(<RouterProvider router={router} />);
}

describe("WardTimetablePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetWardStore();
    resetFeatureStore();
    vi.mocked(wardsApi.listMyWards).mockResolvedValue([WARD]);
    vi.mocked(wardsApi.getWardTimetable).mockResolvedValue({
      classId: "class-1",
      className: "Primary 3",
      termId: "term-1",
      editable: false,
      periods: [],
      suggestedTeachers: {},
    });
  });

  it("shows the current term's timetable with no term picker", async () => {
    vi.mocked(wardsApi.listWardTerms).mockResolvedValue([
      term(1, "First Term", { currentTerm: true }),
      term(2, "Second Term"),
      term(3, "Third Term"),
    ]);

    renderPage();

    await waitFor(() => expect(wardsApi.getWardTimetable).toHaveBeenCalledWith("s1", "term-1"));
    expect(wardsApi.getWardTimetable).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("First Term · 2026/2027")).toBeInTheDocument();
    expect(screen.queryByLabelText("Term")).not.toBeInTheDocument();
  });

  it("shows an empty state and fetches no timetable when no term is marked current", async () => {
    vi.mocked(wardsApi.listWardTerms).mockResolvedValue([
      term(1, "First Term"),
      term(2, "Second Term"),
    ]);

    renderPage();

    expect(await screen.findByText("No current term")).toBeInTheDocument();
    expect(wardsApi.getWardTimetable).not.toHaveBeenCalled();
  });
});

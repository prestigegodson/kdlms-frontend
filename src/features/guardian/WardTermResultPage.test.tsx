import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as wardsApi from "@/api/wards";
import { ApiError } from "@/api/client";
import { WardResultsLayout } from "@/features/guardian/WardResultsLayout";
import { WardTermResultPage } from "@/features/guardian/WardTermResultPage";
import { resetAuthStore, useAuthStore } from "@/stores/authStore";
import { resetWardStore } from "@/stores/wardStore";

vi.mock("@/api/wards", async () => {
  const actual = await vi.importActual<typeof import("@/api/wards")>("@/api/wards");
  return { ...actual, listMyWards: vi.fn(), listWardTerms: vi.fn(), getWardResult: vi.fn() };
});

const WARD = {
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
  sessionId: "sess-1",
  sessionName: "2026/2027",
  currentSession: true,
  termId: "term-1",
  termName: "First Term",
  termNumber: 1,
  classId: "class-1",
  className: "Primary 3",
  resultsPublished: true,
  midtermPublished: true,
};

const RESULT_1 = {
  result: {
    studentId: "s1",
    enrollmentId: "enr-1",
    studentName: "Ada Obi",
    admissionNumber: "SCH/2026/0001",
    classId: "class-1",
    termId: "term-1",
    assessmentMode: "NUMERIC" as const,
    subjects: [{ subjectId: "subj-1", name: "Mathematics" }],
    subjectResults: [{ subjectId: "subj-1", finalScore: 88, grade: "A" }],
    total: 176,
    average: 88,
    position: 1,
    traits: [],
  },
  gradingSystem: {
    levelId: "level-1",
    levelName: "Primary",
    baseLevel: "PRIMARY" as const,
    assessmentMode: "NUMERIC" as const,
    showPosition: true,
    showMidtermGrade: true,
    boundaries: [{ grade: "A", minScore: 70, maxScore: 100, remark: "Excellent" }],
    ratingOptions: [],
    configured: true,
  },
  traitConfiguration: {
    levelId: "level-1",
    levelName: "Primary",
    affectiveEnabled: false,
    psychomotorEnabled: false,
    affective: { scaleOptions: [], traits: [] },
    psychomotor: { scaleOptions: [], traits: [] },
    configured: false,
  },
};

function renderPage(initialPath = "/guardian/results/s1/sess-1/term-1") {
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
      {
        path: "/guardian/results/:studentId",
        element: <WardResultsLayout />,
        children: [{ path: ":sessionId/:termId", element: <WardTermResultPage /> }],
      },
    ],
    { initialEntries: [initialPath] },
  );
  render(<RouterProvider router={router} />);
}

describe("WardTermResultPage (step 4 - the report)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetWardStore();
    vi.mocked(wardsApi.listMyWards).mockResolvedValue([WARD]);
    vi.mocked(wardsApi.listWardTerms).mockResolvedValue([TERM_1]);
  });

  it("fetches the result for the studentId/termId in the URL and renders it", async () => {
    vi.mocked(wardsApi.getWardResult).mockResolvedValue(RESULT_1);

    renderPage();

    expect(await screen.findByText("Mathematics")).toBeInTheDocument();
    expect(screen.getByText("176")).toBeInTheDocument();
    expect(wardsApi.getWardResult).toHaveBeenCalledWith("s1", "term-1", "TERM");
  });

  it("shows 'Results not published yet' rather than a raw error on a 404", async () => {
    vi.mocked(wardsApi.getWardResult).mockRejectedValue(new ApiError(404, "Not found"));

    renderPage();

    expect(await screen.findByText("Results not published yet")).toBeInTheDocument();
  });

  it("reads scope from ?scope=MIDTERM, fetches the mid-term result, and shows the mid-term empty state on 404", async () => {
    vi.mocked(wardsApi.getWardResult).mockRejectedValue(new ApiError(404, "Not found"));

    renderPage("/guardian/results/s1/sess-1/term-1?scope=MIDTERM");

    expect(await screen.findByText("Mid-term results not published yet")).toBeInTheDocument();
    expect(wardsApi.getWardResult).toHaveBeenCalledWith("s1", "term-1", "MIDTERM");
  });
});

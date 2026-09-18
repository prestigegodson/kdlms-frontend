import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as studentApi from "@/api/student";
import { ApiError } from "@/api/client";
import { StudentTermResultPage } from "@/features/student/StudentTermResultPage";
import { resetStudentStore, useStudentStore } from "@/stores/studentStore";

vi.mock("@/api/student", async () => {
  const actual = await vi.importActual<typeof import("@/api/student")>("@/api/student");
  return { ...actual, getMyResult: vi.fn() };
});

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
    studentName: "Grace Ward",
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

function renderPage(initialPath = "/student/results/sess-1/term-1") {
  const router = createMemoryRouter(
    [{ path: "/student/results/:sessionId/:termId", element: <StudentTermResultPage /> }],
    { initialEntries: [initialPath] },
  );
  render(<RouterProvider router={router} />);
}

describe("StudentTermResultPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStudentStore();
    useStudentStore.setState({ terms: [TERM_1], status: "loaded" });
  });

  it("fetches the result for the termId in the URL and renders it", async () => {
    vi.mocked(studentApi.getMyResult).mockResolvedValue(RESULT_1);

    renderPage();

    expect(await screen.findByText("Mathematics")).toBeInTheDocument();
    expect(screen.getByText("176")).toBeInTheDocument();
    expect(studentApi.getMyResult).toHaveBeenCalledWith("term-1", "TERM");
  });

  it("shows 'Results not published yet' rather than a raw error on a 404", async () => {
    vi.mocked(studentApi.getMyResult).mockRejectedValue(new ApiError(404, "Not found"));

    renderPage();

    expect(await screen.findByText("Results not published yet")).toBeInTheDocument();
  });

  it("reads scope from ?scope=MIDTERM, fetches the mid-term result, and shows the mid-term empty state on 404", async () => {
    vi.mocked(studentApi.getMyResult).mockRejectedValue(new ApiError(404, "Not found"));

    renderPage("/student/results/sess-1/term-1?scope=MIDTERM");

    expect(await screen.findByText("Mid-term results not published yet")).toBeInTheDocument();
    expect(studentApi.getMyResult).toHaveBeenCalledWith("term-1", "MIDTERM");
  });
});

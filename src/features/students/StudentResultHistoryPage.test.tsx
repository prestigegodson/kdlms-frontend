import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as assessmentsApi from "@/api/assessments";
import { ApiError } from "@/api/client";
import * as gradingSystemsApi from "@/api/gradingSystems";
import * as studentsApi from "@/api/students";
import type { StudentTermView, StudentView } from "@/api/students";
import { StudentResultHistoryPage } from "@/features/students/StudentResultHistoryPage";
import { resetAuthStore, useAuthStore } from "@/stores/authStore";

vi.mock("@/api/students", async () => {
  const actual = await vi.importActual<typeof import("@/api/students")>("@/api/students");
  return { ...actual, getStudent: vi.fn(), listStudentTerms: vi.fn() };
});

vi.mock("@/api/assessments", async () => {
  const actual = await vi.importActual<typeof import("@/api/assessments")>("@/api/assessments");
  return { ...actual, getStudentResult: vi.fn() };
});

vi.mock("@/api/gradingSystems", async () => {
  const actual = await vi.importActual<typeof import("@/api/gradingSystems")>("@/api/gradingSystems");
  return { ...actual, getGradingSystem: vi.fn() };
});

vi.mock("@/api/reports", async () => {
  const actual = await vi.importActual<typeof import("@/api/reports")>("@/api/reports");
  return { ...actual, previewStudentReport: vi.fn(), downloadStudentReportPdf: vi.fn() };
});

const STUDENT_VIEW: StudentView = {
  id: "student-1",
  schoolId: "school-1",
  branchId: "branch-1",
  admissionNumber: "BFA/2025/0001",
  firstName: "Ada",
  lastName: "Obi",
  fullName: "Ada Obi",
  gender: "FEMALE",
  status: "ACTIVE",
};

const TERM_1: StudentTermView = {
  sessionId: "sess-1",
  sessionName: "2025/2026",
  currentSession: false,
  termId: "term-1",
  termName: "First Term",
  termNumber: 1,
  classId: "class-1",
  className: "Primary 1",
  levelId: "level-1",
  resultsPublished: true,
  midtermPublished: true,
};

const TERM_2: StudentTermView = {
  ...TERM_1,
  termId: "term-2",
  termName: "Second Term",
  termNumber: 2,
  resultsPublished: false,
  midtermPublished: false,
};

const OTHER_SESSION_TERM: StudentTermView = {
  ...TERM_1,
  sessionId: "sess-2",
  sessionName: "2026/2027",
  termId: "term-3",
};

const RESULT_1 = {
  studentId: "student-1",
  enrollmentId: "enr-1",
  studentName: "Ada Obi",
  admissionNumber: "BFA/2025/0001",
  classId: "class-1",
  termId: "term-1",
  assessmentMode: "NUMERIC" as const,
  subjects: [{ subjectId: "subj-1", name: "Mathematics" }],
  subjectResults: [{ subjectId: "subj-1", finalScore: 88, grade: "A" }],
  total: 88,
  average: 88,
  position: 1,
};

const GRADING_SYSTEM = {
  levelId: "level-1",
  levelName: "Primary",
  baseLevel: "PRIMARY" as const,
  assessmentMode: "NUMERIC" as const,
  showPosition: true,
  showMidtermGrade: true,
  boundaries: [{ grade: "A", minScore: 70, maxScore: 100, remark: "Excellent" }],
  ratingOptions: [],
  configured: true,
};

function renderPage(initialPath = "/school/students/student-1/results/sess-1") {
  resetAuthStore();
  useAuthStore.setState({
    user: {
      id: "user-1",
      email: "admin@school.example",
      firstName: "Ada",
      lastName: "Obi",
      role: "SCHOOL_ADMIN",
      schoolId: "school-1",
    },
    accessToken: "access",
    refreshToken: "refresh",
  });
  const router = createMemoryRouter(
    [{ path: "/school/students/:studentId/results/:sessionId", element: <StudentResultHistoryPage /> }],
    { initialEntries: [initialPath] },
  );
  render(<RouterProvider router={router} />);
}

describe("StudentResultHistoryPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(studentsApi.getStudent).mockResolvedValue(STUDENT_VIEW);
    vi.mocked(gradingSystemsApi.getGradingSystem).mockResolvedValue(GRADING_SYSTEM);
  });

  it("filters terms to the session in the URL, defaults to a term, and shows a published badge per term", async () => {
    vi.mocked(studentsApi.listStudentTerms).mockResolvedValue([TERM_1, TERM_2, OTHER_SESSION_TERM]);
    vi.mocked(assessmentsApi.getStudentResult).mockResolvedValue(RESULT_1);

    renderPage();

    expect(await screen.findByRole("button", { name: /First Term/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Second Term/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /2026\/2027/ })).not.toBeInTheDocument();
    expect(screen.getByText("Published")).toBeInTheDocument();
    expect(screen.getByText("Unpublished")).toBeInTheDocument();
    expect(await screen.findByText("Mathematics")).toBeInTheDocument();
  });

  it("fetches and renders the selected term's result, and refetches on term change", async () => {
    vi.mocked(studentsApi.listStudentTerms).mockResolvedValue([TERM_1, TERM_2]);
    vi.mocked(assessmentsApi.getStudentResult).mockResolvedValue(RESULT_1);
    const user = userEvent.setup();

    renderPage();

    expect(await screen.findByText("Mathematics")).toBeInTheDocument();
    expect(assessmentsApi.getStudentResult).toHaveBeenCalledWith("student-1", "term-1", "TERM");

    await user.click(screen.getByRole("button", { name: /Second Term/ }));

    expect(assessmentsApi.getStudentResult).toHaveBeenCalledWith("student-1", "term-2", "TERM");
  });

  it("shows a 'no results recorded' empty state on a 404 rather than a raw error", async () => {
    vi.mocked(studentsApi.listStudentTerms).mockResolvedValue([TERM_1]);
    vi.mocked(assessmentsApi.getStudentResult).mockRejectedValue(new ApiError(404, "Not found"));

    renderPage();

    expect(await screen.findByText("No results recorded")).toBeInTheDocument();
  });
});

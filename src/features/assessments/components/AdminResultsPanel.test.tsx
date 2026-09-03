import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as assessmentsApi from "@/api/assessments";
import type { BroadsheetView } from "@/api/assessments";
import * as classesApi from "@/api/classes";
import * as gradingSystemsApi from "@/api/gradingSystems";
import * as sessionsApi from "@/api/sessions";
import type { AcademicSessionView, TermView } from "@/api/sessions";
import { AdminResultsPanel } from "@/features/assessments/components/AdminResultsPanel";
import { resetAuthStore, useAuthStore } from "@/stores/authStore";
import { resetBranchStore } from "@/stores/branchStore";

vi.mock("@/api/assessments", async () => {
  const actual = await vi.importActual<typeof import("@/api/assessments")>("@/api/assessments");
  return {
    ...actual,
    getBroadsheet: vi.fn(),
    getPublicationStatus: vi.fn(),
    publishResults: vi.fn(),
    unpublishResults: vi.fn(),
    getRemarksSheet: vi.fn(),
  };
});

vi.mock("@/api/classes", async () => {
  const actual = await vi.importActual<typeof import("@/api/classes")>("@/api/classes");
  return { ...actual, listClasses: vi.fn() };
});

vi.mock("@/api/gradingSystems", async () => {
  const actual = await vi.importActual<typeof import("@/api/gradingSystems")>("@/api/gradingSystems");
  return { ...actual, getGradingSystem: vi.fn() };
});

vi.mock("@/api/sessions", async () => {
  const actual = await vi.importActual<typeof import("@/api/sessions")>("@/api/sessions");
  return { ...actual, listSessions: vi.fn(), listTerms: vi.fn() };
});

const SESSION: AcademicSessionView = {
  id: "session-1",
  schoolId: "school-1",
  name: "2026/2027",
  startDate: "2026-09-01",
  endDate: null,
  current: true,
};

const TERM: TermView = {
  id: "term-1",
  schoolId: "school-1",
  sessionId: "session-1",
  termNumber: 1,
  name: "First Term",
  startDate: "2026-09-01",
  endDate: "2026-12-01",
  current: true,
};

const CLASS_1 = {
  id: "class-1",
  schoolId: "school-1",
  branchId: "branch-1",
  levelId: "level-1",
  name: "Primary 1A",
  status: "ACTIVE" as const,
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

const BROADSHEET: BroadsheetView = {
  classId: "class-1",
  termId: "term-1",
  assessmentMode: "NUMERIC",
  subjects: [{ subjectId: "subject-1", name: "Mathematics", code: "MTH" }],
  rows: [
    {
      enrollmentId: "enrollment-1",
      studentId: "student-1",
      studentName: "Ada Obi",
      admissionNumber: "SCH/2026/0001",
      subjectResults: [{ subjectId: "subject-1", finalScore: 90, grade: "A" }],
      total: 90,
      average: 90,
      position: 1,
    },
  ],
};

function renderPanel() {
  resetAuthStore();
  resetBranchStore();
  useAuthStore.setState({
    user: {
      id: "user-1",
      email: "admin@school.example",
      firstName: "A",
      lastName: "B",
      role: "BRANCH_ADMIN",
      schoolId: "school-1",
      branchId: "branch-1",
    },
    accessToken: "access",
    refreshToken: "refresh",
  });
  const router = createMemoryRouter([{ path: "/", element: <AdminResultsPanel /> }], { initialEntries: ["/"] });
  render(<RouterProvider router={router} />);
}

describe("AdminResultsPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(classesApi.listClasses).mockResolvedValue({
      content: [CLASS_1],
      totalElements: 1,
      totalPages: 1,
      number: 0,
      size: 200,
    });
    vi.mocked(sessionsApi.listSessions).mockResolvedValue({
      content: [SESSION],
      totalElements: 1,
      totalPages: 1,
      number: 0,
      size: 50,
    });
    vi.mocked(sessionsApi.listTerms).mockResolvedValue([TERM]);
    vi.mocked(gradingSystemsApi.getGradingSystem).mockResolvedValue(GRADING_SYSTEM);
    vi.mocked(assessmentsApi.getBroadsheet).mockResolvedValue(BROADSHEET);
    vi.mocked(assessmentsApi.getRemarksSheet).mockResolvedValue({
      classId: "class-1",
      className: "Primary 1A",
      termId: "term-1",
      classTeacherEditable: false,
      principalRemarkEditable: true,
      rows: [],
    });
  });

  it("defaults to End of term, then refetches the broadsheet and publication status with MIDTERM on toggle", async () => {
    const user = userEvent.setup();
    vi.mocked(assessmentsApi.getPublicationStatus).mockResolvedValue({ published: false });

    renderPanel();

    await user.selectOptions(await screen.findByLabelText("Class"), "class-1");
    expect(await screen.findByText("MTH")).toBeInTheDocument();
    expect(assessmentsApi.getBroadsheet).toHaveBeenCalledWith("class-1", "term-1", "TERM");

    await user.click(screen.getByRole("radio", { name: "Mid-term" }));

    expect(await screen.findByText("MTH")).toBeInTheDocument();
    expect(assessmentsApi.getBroadsheet).toHaveBeenCalledWith("class-1", "term-1", "MIDTERM");
    expect(assessmentsApi.getPublicationStatus).toHaveBeenCalledWith("class-1", "term-1", "MIDTERM");
  });

  it("relabels the publish button and scopes the publish call once Mid-term is selected", async () => {
    const user = userEvent.setup();
    vi.mocked(assessmentsApi.getPublicationStatus).mockResolvedValue({ published: false });
    vi.mocked(assessmentsApi.publishResults).mockResolvedValue(undefined);

    renderPanel();
    await user.selectOptions(await screen.findByLabelText("Class"), "class-1");
    await screen.findByRole("button", { name: "Publish results" });

    await user.click(screen.getByRole("radio", { name: "Mid-term" }));

    const publishButton = await screen.findByRole("button", { name: "Publish mid-term results" });
    await user.click(publishButton);

    expect(assessmentsApi.publishResults).toHaveBeenCalledWith("class-1", "term-1", "MIDTERM");
  });

  it("tracks the two scopes' published badges independently", async () => {
    const user = userEvent.setup();
    vi.mocked(assessmentsApi.getPublicationStatus).mockImplementation((_classId, _termId, scope) =>
      Promise.resolve({ published: scope === "TERM" }),
    );

    renderPanel();
    await user.selectOptions(await screen.findByLabelText("Class"), "class-1");

    expect(await screen.findByText("Published")).toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: "Mid-term" }));

    expect(await screen.findByText("Not yet published")).toBeInTheDocument();
  });
});

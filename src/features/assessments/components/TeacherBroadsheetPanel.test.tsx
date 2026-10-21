import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as assessmentsApi from "@/api/assessments";
import type { BroadsheetView } from "@/api/assessments";
import * as gradingSystemsApi from "@/api/gradingSystems";
import * as meApi from "@/api/me";
import type { TeacherClassView } from "@/api/me";
import * as sessionsApi from "@/api/sessions";
import type { AcademicSessionView, TermView } from "@/api/sessions";
import { TeacherBroadsheetPanel } from "@/features/assessments/components/TeacherBroadsheetPanel";
import * as download from "@/utils/download";

vi.mock("@/api/assessments", async () => {
  const actual = await vi.importActual<typeof import("@/api/assessments")>("@/api/assessments");
  return { ...actual, getBroadsheet: vi.fn() };
});

vi.mock("@/api/me", async () => {
  const actual = await vi.importActual<typeof import("@/api/me")>("@/api/me");
  return { ...actual, listMyClasses: vi.fn() };
});

vi.mock("@/api/gradingSystems", async () => {
  const actual = await vi.importActual<typeof import("@/api/gradingSystems")>("@/api/gradingSystems");
  return { ...actual, getGradingSystem: vi.fn() };
});

vi.mock("@/api/sessions", async () => {
  const actual = await vi.importActual<typeof import("@/api/sessions")>("@/api/sessions");
  return { ...actual, listSessions: vi.fn(), listTerms: vi.fn() };
});

vi.mock("@/utils/download", () => ({ downloadBlob: vi.fn() }));

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

function teacherClass(classId: string, className: string, isClassTeacher: boolean): TeacherClassView {
  return {
    classId,
    branchId: "branch-1",
    levelId: "level-1",
    className,
    isClassTeacher,
    isAssistantTeacher: false,
    subjectIds: [],
  };
}

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

describe("TeacherBroadsheetPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(meApi.listMyClasses).mockResolvedValue([
      teacherClass("class-1", "Primary 1A", true),
      teacherClass("class-2", "Primary 2B", false),
    ]);
    vi.mocked(sessionsApi.listSessions).mockResolvedValue({
      content: [SESSION],
      totalElements: 1,
      totalPages: 1,
      number: 0,
      size: 50,
    });
    vi.mocked(sessionsApi.listTerms).mockResolvedValue([TERM]);
    vi.mocked(gradingSystemsApi.getGradingSystem).mockRejectedValue(new Error("not needed"));
    vi.mocked(assessmentsApi.getBroadsheet).mockResolvedValue(BROADSHEET);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("offers only the classes the teacher class-teaches, not subject-only ones", async () => {
    render(<TeacherBroadsheetPanel />);

    const classSelect = await screen.findByLabelText("Class");
    expect(within(classSelect).getByRole("option", { name: "Primary 1A" })).toBeInTheDocument();
    expect(within(classSelect).queryByRole("option", { name: "Primary 2B" })).not.toBeInTheDocument();
  });

  it("shows an empty state for a subject-only teacher", async () => {
    vi.mocked(meApi.listMyClasses).mockResolvedValue([teacherClass("class-2", "Primary 2B", false)]);

    render(<TeacherBroadsheetPanel />);

    expect(await screen.findByText("No class to show")).toBeInTheDocument();
  });

  it("renders the broadsheet, downloads it as CSV, and prints it", async () => {
    const user = userEvent.setup();
    const printSpy = vi.spyOn(window, "print").mockImplementation(() => undefined);

    render(<TeacherBroadsheetPanel initialClassId="class-1" />);

    expect(await screen.findByText("MTH")).toBeInTheDocument();
    expect(assessmentsApi.getBroadsheet).toHaveBeenCalledWith("class-1", "term-1", "TERM");

    await user.click(screen.getByRole("button", { name: "Download CSV" }));
    expect(download.downloadBlob).toHaveBeenCalledWith(expect.any(Blob), "primary-1a-first-term-broadsheet.csv");
    const blob = vi.mocked(download.downloadBlob).mock.calls[0][0];
    expect(await blob.text()).toContain("Ada Obi,SCH/2026/0001,90 (A),90,90,1");

    await user.click(screen.getByRole("button", { name: "Print" }));
    expect(printSpy).toHaveBeenCalled();
    // The print copy is portalled under <body> with its own heading.
    expect(screen.getByRole("heading", { name: "Primary 1A - 2026/2027, First Term" })).toBeInTheDocument();
  });
});

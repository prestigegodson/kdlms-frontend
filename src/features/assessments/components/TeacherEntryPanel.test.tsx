import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as classesApi from "@/api/classes";
import type { SchoolClassView } from "@/api/classes";
import * as meApi from "@/api/me";
import type { SubjectView } from "@/api/subjects";
import * as sessionsApi from "@/api/sessions";
import type { AcademicSessionView, TermView } from "@/api/sessions";
import { TeacherEntryPanel } from "@/features/assessments/components/TeacherEntryPanel";
import { useTeacherScopeStore } from "@/stores/teacherScopeStore";

vi.mock("@/api/classes", async () => {
  const actual = await vi.importActual<typeof import("@/api/classes")>("@/api/classes");
  return { ...actual, listClasses: vi.fn() };
});

vi.mock("@/api/me", async () => {
  const actual = await vi.importActual<typeof import("@/api/me")>("@/api/me");
  return { ...actual, listMyClasses: vi.fn(), listRecordableSubjects: vi.fn() };
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

function schoolClass(id: string, name: string, levelId: string): SchoolClassView {
  return { id, schoolId: "school-1", branchId: "branch-1", levelId, name, status: "ACTIVE" } as SchoolClassView;
}

describe("TeacherEntryPanel with levelClasses", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useTeacherScopeStore.setState({
      capabilities: {
        isClassTeacher: false,
        classTeacherClassIds: [],
        subjectTeacherClassIds: [],
        headOfLevelIds: ["level-primary"],
      },
    });
    vi.mocked(classesApi.listClasses).mockResolvedValue({
      content: [schoolClass("p1", "Primary 1", "level-primary"), schoolClass("s1", "JSS 1", "level-secondary")],
      totalElements: 2,
      totalPages: 1,
      number: 0,
      size: 200,
    });
    vi.mocked(meApi.listRecordableSubjects).mockResolvedValue([
      { id: "subject-1", name: "Mathematics", graded: true } as SubjectView,
    ]);
    vi.mocked(sessionsApi.listSessions).mockResolvedValue({
      content: [SESSION],
      totalElements: 1,
      totalPages: 1,
      number: 0,
      size: 50,
    });
    vi.mocked(sessionsApi.listTerms).mockResolvedValue([TERM]);
  });

  it("lists only the headed levels' classes and offers All subjects on them", async () => {
    const user = userEvent.setup();
    render(<TeacherEntryPanel levelClasses />);

    const classSelect = await screen.findByLabelText("Class");
    expect(within(classSelect).getByRole("option", { name: "Primary 1" })).toBeInTheDocument();
    expect(within(classSelect).queryByRole("option", { name: "JSS 1" })).not.toBeInTheDocument();
    expect(meApi.listMyClasses).not.toHaveBeenCalled();

    await user.selectOptions(classSelect, "p1");
    await user.click(await screen.findByLabelText("Subject"));

    expect(await screen.findByRole("option", { name: "All subjects" })).toBeInTheDocument();
    expect(meApi.listRecordableSubjects).toHaveBeenCalledWith("p1");
  });
});

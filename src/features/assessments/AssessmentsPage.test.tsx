import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { openSubjectPicker, pickSubject } from "@/test/subjectPicker";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as assessmentsApi from "@/api/assessments";
import * as branchesApi from "@/api/branches";
import * as classesApi from "@/api/classes";
import * as meApi from "@/api/me";
import * as sessionsApi from "@/api/sessions";
import { AssessmentsPage } from "@/features/assessments/AssessmentsPage";
import { resetAuthStore, useAuthStore } from "@/stores/authStore";
import { resetBranchStore } from "@/stores/branchStore";

vi.mock("@/api/me", async () => {
  const actual = await vi.importActual<typeof import("@/api/me")>("@/api/me");
  return { ...actual, listMyClasses: vi.fn(), listRecordableSubjects: vi.fn() };
});

vi.mock("@/api/classes", async () => {
  const actual = await vi.importActual<typeof import("@/api/classes")>("@/api/classes");
  return { ...actual, listClasses: vi.fn() };
});

vi.mock("@/api/branches", async () => {
  const actual = await vi.importActual<typeof import("@/api/branches")>("@/api/branches");
  return { ...actual, listBranches: vi.fn() };
});

vi.mock("@/api/sessions", async () => {
  const actual = await vi.importActual<typeof import("@/api/sessions")>("@/api/sessions");
  return { ...actual, listSessions: vi.fn(), listTerms: vi.fn() };
});

vi.mock("@/api/assessments", async () => {
  const actual = await vi.importActual<typeof import("@/api/assessments")>("@/api/assessments");
  return { ...actual, openSheet: vi.fn(), openClassSheet: vi.fn() };
});

function renderAs(role: "TEACHER" | "SCHOOL_ADMIN", initialEntry = "/") {
  resetAuthStore();
  useAuthStore.setState({
    user: { id: "user-1", email: "user@school.example", firstName: "A", lastName: "B", role, schoolId: "school-1" },
    accessToken: "access",
    refreshToken: "refresh",
  });
  const router = createMemoryRouter([{ path: "/", element: <AssessmentsPage /> }], { initialEntries: [initialEntry] });
  render(<RouterProvider router={router} />);
}

describe("AssessmentsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetBranchStore();
    vi.mocked(meApi.listMyClasses).mockResolvedValue([]);
    vi.mocked(classesApi.listClasses).mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 200 });
    vi.mocked(branchesApi.listBranches).mockResolvedValue({
      content: [{ id: "branch-1", schoolId: "school-1", name: "Main Branch", main: true, status: "ACTIVE" }],
      totalElements: 1,
      totalPages: 1,
      number: 0,
      size: 50,
    });
  });

  it("shows the recording flow for a TEACHER, with a Scores/Remarks tab pair", async () => {
    renderAs("TEACHER");

    expect(await screen.findByText("Assessments")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Scores" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Remarks" })).toHaveAttribute("aria-selected", "false");
  });

  it("switches to the Remarks tab for a TEACHER", async () => {
    const user = userEvent.setup();
    renderAs("TEACHER");
    await screen.findByRole("tab", { name: "Remarks" });

    await user.click(screen.getByRole("tab", { name: "Remarks" }));

    expect(screen.getByRole("tab", { name: "Remarks" })).toHaveAttribute("aria-selected", "true");
    expect(await screen.findByText("No classes assigned yet")).toBeInTheDocument();
  });

  it("shows the read-only results view for a SCHOOL_ADMIN, narrowed to the auto-selected branch", async () => {
    renderAs("SCHOOL_ADMIN");

    expect(await screen.findByText("Pick a class and term to see its results.")).toBeInTheDocument();
    expect(await screen.findByLabelText("Branch")).toBeInTheDocument();
    expect(classesApi.listClasses).toHaveBeenCalledWith("branch-1", undefined, 0, 200);
  });

  it("leaves a non-graded subject out of a teacher's subject picker", async () => {
    vi.mocked(meApi.listMyClasses).mockResolvedValue([
      { classId: "class-1", className: "JSS 1A", branchId: "branch-1", levelId: "level-1", isClassTeacher: true, isAssistantTeacher: false, subjectIds: [] },
    ]);
    vi.mocked(meApi.listRecordableSubjects).mockResolvedValue([
      { id: "subject-1", schoolId: "school-1", levelId: "level-1", name: "Mathematics", selective: false, graded: true, assessmentPeriods: "BOTH", termNumbers: [1, 2, 3], status: "ACTIVE" },
      { id: "subject-2", schoolId: "school-1", levelId: "level-1", name: "Assembly", selective: false, graded: false, assessmentPeriods: "BOTH", termNumbers: [1, 2, 3], status: "ACTIVE" },
    ]);
    vi.mocked(sessionsApi.listSessions).mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 50 });

    renderAs("TEACHER", "/?classId=class-1");

    await openSubjectPicker(userEvent.setup());
    expect(await screen.findByRole("option", { name: "Mathematics" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Assembly" })).not.toBeInTheDocument();
  });

  it("sections a teacher's subject picker by subject group", async () => {
    vi.mocked(meApi.listMyClasses).mockResolvedValue([
      { classId: "class-1", className: "JSS 1A", branchId: "branch-1", levelId: "level-1", isClassTeacher: true, isAssistantTeacher: false, subjectIds: [] },
    ]);
    vi.mocked(meApi.listRecordableSubjects).mockResolvedValue([
      { id: "subject-1", schoolId: "school-1", levelId: "level-1", name: "Physics", subjectGroupId: "group-1", subjectGroupName: "Sciences", selective: false, graded: true, assessmentPeriods: "BOTH", termNumbers: [1, 2, 3], status: "ACTIVE" },
      { id: "subject-2", schoolId: "school-1", levelId: "level-1", name: "Chemistry", subjectGroupId: "group-1", subjectGroupName: "Sciences", selective: false, graded: true, assessmentPeriods: "BOTH", termNumbers: [1, 2, 3], status: "ACTIVE" },
      { id: "subject-3", schoolId: "school-1", levelId: "level-1", name: "Mathematics", selective: false, graded: true, assessmentPeriods: "BOTH", termNumbers: [1, 2, 3], status: "ACTIVE" },
    ]);
    vi.mocked(sessionsApi.listSessions).mockResolvedValue({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 50 });

    renderAs("TEACHER", "/?classId=class-1");

    await openSubjectPicker(userEvent.setup());
    const sciences = await screen.findByRole("group", { name: "Sciences" });
    expect(within(sciences).getAllByRole("option").map((option) => option.textContent)).toEqual(["Chemistry", "Physics"]);
    const other = screen.getByRole("group", { name: "Other subjects" });
    expect(within(other).getByRole("option", { name: "Mathematics" })).toBeInTheDocument();
  });

  it("seeds the class and subject from ?classId=&subjectId= (SubjectsPage's \"Record assessment\" row action)", async () => {
    vi.mocked(meApi.listMyClasses).mockResolvedValue([
      { classId: "class-1", className: "JSS 1A", branchId: "branch-1", levelId: "level-1", isClassTeacher: true, isAssistantTeacher: false, subjectIds: ["subject-1"] },
    ]);
    vi.mocked(meApi.listRecordableSubjects).mockResolvedValue([
      { id: "subject-1", schoolId: "school-1", levelId: "level-1", name: "Mathematics", selective: false, graded: true, assessmentPeriods: "BOTH", termNumbers: [1, 2, 3], status: "ACTIVE" },
    ]);
    vi.mocked(sessionsApi.listSessions).mockResolvedValue({
      content: [
        { id: "session-1", schoolId: "school-1", name: "2026/2027", startDate: "2026-09-01", endDate: null, current: true },
      ],
      totalElements: 1,
      totalPages: 1,
      number: 0,
      size: 50,
    });
    vi.mocked(sessionsApi.listTerms).mockResolvedValue([
      { id: "term-1", schoolId: "school-1", sessionId: "session-1", termNumber: 1, name: "First Term", startDate: "2026-09-01", endDate: "2026-12-01", current: true },
    ]);
    vi.mocked(assessmentsApi.openSheet).mockResolvedValue({
      classId: "class-1",
      subjectId: "subject-1",
      termId: "term-1",
      assessmentMode: "NUMERIC",
      assessmentPeriods: "BOTH",
      showMidtermGrade: false,
      boundaries: [],
      ratingOptions: [],
      rows: [],
    });

    renderAs("TEACHER", "/?classId=class-1&subjectId=subject-1");

    // No manual class/subject selection - both seed from the query string, so the sheet loads the
    // moment the (auto-selected) current term resolves alongside them.
    await vi.waitFor(() => expect(assessmentsApi.openSheet).toHaveBeenCalledWith("class-1", "subject-1", "term-1"));
    expect(await screen.findByLabelText("Class")).toHaveValue("class-1");
    expect(screen.getByLabelText("Subject")).toHaveValue("Mathematics");
  });

  function mockSessionAndTerm() {
    vi.mocked(sessionsApi.listSessions).mockResolvedValue({
      content: [
        { id: "session-1", schoolId: "school-1", name: "2026/2027", startDate: "2026-09-01", endDate: null, current: true },
      ],
      totalElements: 1,
      totalPages: 1,
      number: 0,
      size: 50,
    });
    vi.mocked(sessionsApi.listTerms).mockResolvedValue([
      { id: "term-1", schoolId: "school-1", sessionId: "session-1", termNumber: 1, name: "First Term", startDate: "2026-09-01", endDate: "2026-12-01", current: true },
    ]);
  }

  it("offers \"All subjects\" to a class teacher and opens the all-subjects sheet", async () => {
    vi.mocked(meApi.listMyClasses).mockResolvedValue([
      { classId: "class-1", className: "Nursery 1", branchId: "branch-1", levelId: "level-1", isClassTeacher: true, isAssistantTeacher: false, subjectIds: [] },
    ]);
    vi.mocked(meApi.listRecordableSubjects).mockResolvedValue([
      { id: "subject-1", schoolId: "school-1", levelId: "level-1", name: "Numeracy", selective: false, graded: true, assessmentPeriods: "BOTH", termNumbers: [1, 2, 3], status: "ACTIVE" },
    ]);
    mockSessionAndTerm();
    vi.mocked(assessmentsApi.openClassSheet).mockResolvedValue({
      classId: "class-1",
      termId: "term-1",
      assessmentMode: "QUALITATIVE",
      ratingOptions: [{ id: "rating-1", label: "Meets Expectation", rank: 1 }],
      subjects: [{ subjectId: "subject-1", name: "Numeracy", assessmentPeriods: "BOTH" }],
      students: [{ enrollmentId: "enrollment-1", studentName: "Adebayo Tolu", admissionNumber: "SCH/0001" }],
      cells: [{ enrollmentId: "enrollment-1", subjectId: "subject-1", offered: true }],
    });

    renderAs("TEACHER", "/?classId=class-1");
    await pickSubject(userEvent.setup(), "All subjects");

    await vi.waitFor(() => expect(assessmentsApi.openClassSheet).toHaveBeenCalledWith("class-1", "term-1"));
    expect(await screen.findByLabelText("Mid-term rating for Adebayo Tolu in Numeracy")).toBeInTheDocument();
    expect(assessmentsApi.openSheet).not.toHaveBeenCalled();
  });

  it("doesn't offer \"All subjects\" for a class the teacher only subject-teaches", async () => {
    vi.mocked(meApi.listMyClasses).mockResolvedValue([
      { classId: "class-1", className: "JSS 1A", branchId: "branch-1", levelId: "level-1", isClassTeacher: false, isAssistantTeacher: false, subjectIds: ["subject-1"] },
    ]);
    vi.mocked(meApi.listRecordableSubjects).mockResolvedValue([
      { id: "subject-1", schoolId: "school-1", levelId: "level-1", name: "Mathematics", selective: false, graded: true, assessmentPeriods: "BOTH", termNumbers: [1, 2, 3], status: "ACTIVE" },
    ]);
    mockSessionAndTerm();

    renderAs("TEACHER", "/?classId=class-1");

    const listbox = await openSubjectPicker(userEvent.setup());
    expect(await within(listbox).findByRole("option", { name: "Mathematics" })).toBeInTheDocument();
    expect(within(listbox).queryByRole("option", { name: "All subjects" })).not.toBeInTheDocument();
  });
});

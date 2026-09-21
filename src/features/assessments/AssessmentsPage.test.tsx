import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
  return { ...actual, openSheet: vi.fn() };
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

  it("seeds the class and subject from ?classId=&subjectId= (SubjectsPage's \"Record assessment\" row action)", async () => {
    vi.mocked(meApi.listMyClasses).mockResolvedValue([
      { classId: "class-1", className: "JSS 1A", branchId: "branch-1", levelId: "level-1", isClassTeacher: true, subjectIds: ["subject-1"] },
    ]);
    vi.mocked(meApi.listRecordableSubjects).mockResolvedValue([
      { id: "subject-1", schoolId: "school-1", levelId: "level-1", name: "Mathematics", selective: false, termNumbers: [1, 2, 3], status: "ACTIVE" },
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
    expect(screen.getByLabelText("Subject")).toHaveValue("subject-1");
  });
});

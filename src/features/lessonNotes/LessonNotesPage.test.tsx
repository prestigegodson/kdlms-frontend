import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as lessonNotesApi from "@/api/lessonNotes";
import * as levelsApi from "@/api/levels";
import * as sessionsApi from "@/api/sessions";
import * as subjectsApi from "@/api/subjects";
import { LessonNotesPage } from "@/features/lessonNotes/LessonNotesPage";
import { resetAuthStore, useAuthStore } from "@/stores/authStore";
import { resetBranchStore, useBranchStore } from "@/stores/branchStore";
import { resetLevelStore } from "@/stores/levelStore";

vi.mock("@/api/lessonNotes", async () => {
  const actual = await vi.importActual<typeof import("@/api/lessonNotes")>("@/api/lessonNotes");
  return {
    ...actual,
    getMyLessonNoteSubjects: vi.fn(),
    getMyLessonNoteClasses: vi.fn(),
    getClassWeekGrid: vi.fn(),
    getReviewQueue: vi.fn(),
    getWeekGrid: vi.fn(),
    copyLessonNotes: vi.fn(),
  };
});

vi.mock("@/api/subjects", async () => {
  const actual = await vi.importActual<typeof import("@/api/subjects")>("@/api/subjects");
  return { ...actual, listSubjects: vi.fn() };
});

vi.mock("@/api/levels", async () => {
  const actual = await vi.importActual<typeof import("@/api/levels")>("@/api/levels");
  return { ...actual, listLevels: vi.fn() };
});

vi.mock("@/api/sessions", async () => {
  const actual = await vi.importActual<typeof import("@/api/sessions")>("@/api/sessions");
  return { ...actual, listSessions: vi.fn(), listTerms: vi.fn() };
});

function renderAs(role: "TEACHER" | "SCHOOL_ADMIN", initialEntry = "/") {
  resetAuthStore();
  useAuthStore.setState({
    user: {
      id: "user-1",
      email: "user@school.example",
      firstName: "A",
      lastName: "B",
      role,
      schoolId: "school-1",
    },
    accessToken: "access",
    refreshToken: "refresh",
  });
  const router = createMemoryRouter([{ path: "/", element: <LessonNotesPage /> }], {
    initialEntries: [initialEntry],
  });
  render(<RouterProvider router={router} />);
}

describe("LessonNotesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetLevelStore();
    resetBranchStore();
    useBranchStore.setState({ status: "loaded", branches: [], selectedBranchId: null });
    vi.mocked(lessonNotesApi.getMyLessonNoteSubjects).mockResolvedValue([]);
    vi.mocked(lessonNotesApi.getMyLessonNoteClasses).mockResolvedValue([]);
    vi.mocked(subjectsApi.listSubjects).mockResolvedValue({
      content: [],
      totalElements: 0,
      totalPages: 0,
      number: 0,
      size: 500,
    });
    vi.mocked(levelsApi.listLevels).mockResolvedValue([]);
    vi.mocked(lessonNotesApi.getReviewQueue).mockResolvedValue({
      content: [],
      totalElements: 0,
      totalPages: 0,
      number: 0,
      size: 20,
    });
    vi.mocked(sessionsApi.listSessions).mockResolvedValue({
      content: [],
      totalElements: 0,
      totalPages: 0,
      number: 0,
      size: 50,
    });
    vi.mocked(sessionsApi.listTerms).mockResolvedValue([]);
  });

  it("shows the teacher's own-subjects empty state for a TEACHER with no assignments", async () => {
    renderAs("TEACHER");

    expect(await screen.findByText("No subjects assigned")).toBeInTheDocument();
    expect(lessonNotesApi.getMyLessonNoteSubjects).toHaveBeenCalled();
    expect(subjectsApi.listSubjects).not.toHaveBeenCalled();
  });

  it("defaults a SCHOOL_ADMIN to the review queue, showing its empty state", async () => {
    renderAs("SCHOOL_ADMIN");

    expect(await screen.findByText("Nothing to review")).toBeInTheDocument();
    expect(lessonNotesApi.getReviewQueue).toHaveBeenCalled();
  });

  it("gives a SCHOOL_ADMIN a branch filter and scopes the review queue to the selected branch", async () => {
    useBranchStore.setState({
      status: "loaded",
      branches: [
        { id: "branch-1", schoolId: "school-1", name: "Main Campus", main: true, status: "ACTIVE" },
        { id: "branch-2", schoolId: "school-1", name: "Lekki Campus", main: false, status: "ACTIVE" },
      ],
      selectedBranchId: "branch-1",
    });
    renderAs("SCHOOL_ADMIN");
    await screen.findByText("Nothing to review");
    expect(lessonNotesApi.getReviewQueue).toHaveBeenLastCalledWith(
      undefined,
      undefined,
      "SUBMITTED",
      0,
      20,
      "branch-1",
    );

    await userEvent.selectOptions(screen.getByLabelText("Branch"), "Lekki Campus");

    await vi.waitFor(() =>
      expect(lessonNotesApi.getReviewQueue).toHaveBeenLastCalledWith(
        undefined,
        undefined,
        "SUBMITTED",
        0,
        20,
        "branch-2",
      ),
    );
  });

  it("offers a TEACHER with no classes no By class tab", async () => {
    renderAs("TEACHER");

    await screen.findByText("No subjects assigned");
    expect(screen.queryByRole("tab", { name: "By class" })).not.toBeInTheDocument();
  });

  it("lets a class teacher open their class's whole-class week grid", async () => {
    const session = { id: "session-1", schoolId: "school-1", name: "2026/2027", startDate: "2026-09-01", endDate: null, current: true };
    const term = { id: "term-1", schoolId: "school-1", sessionId: "session-1", termNumber: 1, name: "First Term", startDate: "2026-09-01", endDate: "2026-12-01", current: true };
    vi.mocked(sessionsApi.listSessions).mockResolvedValue({ content: [session], totalElements: 1, totalPages: 1, number: 0, size: 50 });
    vi.mocked(sessionsApi.listTerms).mockResolvedValue([term]);
    vi.mocked(lessonNotesApi.getMyLessonNoteClasses).mockResolvedValue([
      { classId: "class-1", className: "Primary 3A", levelId: "level-1", levelName: "Primary", authorable: true },
    ]);
    vi.mocked(lessonNotesApi.getClassWeekGrid).mockResolvedValue({
      classId: "class-1",
      className: "Primary 3A",
      levelId: "level-1",
      levelName: "Primary",
      branchId: "branch-1",
      subjectNames: ["English", "Mathematics"],
      weeks: [{ weekNumber: 1, weekStart: "2026-09-01", weekEnd: "2026-09-05", noteId: null, topic: null, status: null }],
    });
    renderAs("TEACHER");
    const user = userEvent.setup();

    await user.click(await screen.findByRole("tab", { name: "By class" }));
    await user.selectOptions(screen.getByLabelText("Class"), "class-1");

    await vi.waitFor(() => expect(lessonNotesApi.getClassWeekGrid).toHaveBeenCalledWith("class-1", "term-1"));
    expect((await screen.findByText("Week 1")).closest("tr")).toHaveAttribute("tabindex");
  });

  it("shows no branch filter to a TEACHER, whose branch the server derives", async () => {
    renderAs("TEACHER");

    await screen.findByText("No subjects assigned");
    expect(screen.queryByLabelText("Branch")).not.toBeInTheDocument();
  });

  it("shows the school-wide catalogue empty state for a SCHOOL_ADMIN on the Browse by subject tab", async () => {
    renderAs("SCHOOL_ADMIN");
    await screen.findByText("Nothing to review");

    await userEvent.click(screen.getByRole("tab", { name: "Browse by subject" }));

    expect(await screen.findByText("No subjects yet")).toBeInTheDocument();
    expect(subjectsApi.listSubjects).toHaveBeenCalledWith(undefined, 0, 500);
    expect(lessonNotesApi.getMyLessonNoteSubjects).not.toHaveBeenCalled();
  });

  describe("copy from another term", () => {
    const CURRENT_SESSION = { id: "session-1", schoolId: "school-1", name: "2026/2027", startDate: "2026-09-01", endDate: null, current: true };
    const CURRENT_TERM = { id: "term-1", schoolId: "school-1", sessionId: "session-1", termNumber: 1, name: "First Term", startDate: "2026-09-01", endDate: "2026-12-01", current: true };

    beforeEach(() => {
      vi.mocked(lessonNotesApi.getMyLessonNoteSubjects).mockResolvedValue([
        { levelId: "level-1", levelName: "Primary", subjectId: "subject-1", subjectName: "Mathematics", authorable: true },
      ]);
      vi.mocked(lessonNotesApi.getWeekGrid).mockResolvedValue([]);
      vi.mocked(sessionsApi.listSessions).mockResolvedValue({
        content: [CURRENT_SESSION],
        totalElements: 1,
        totalPages: 1,
        number: 0,
        size: 50,
      });
      vi.mocked(sessionsApi.listTerms).mockResolvedValue([CURRENT_TERM]);
    });

    it("seeds the subject from ?subjectId= (SubjectsPage's row action), not classId - lesson notes are level-scoped", async () => {
      renderAs("TEACHER", "/?subjectId=subject-1");

      // No manual subject selection - it seeds from the query string, and the week grid fetches
      // the moment the (auto-selected) current term resolves alongside it.
      await vi.waitFor(() => expect(lessonNotesApi.getWeekGrid).toHaveBeenCalledWith("subject-1", "term-1"));
      expect(await screen.findByLabelText("Subject")).toHaveValue("subject-1");
    });

    it("shows a class teacher's subject that has a subject teacher read-only, with no copy trigger", async () => {
      vi.mocked(lessonNotesApi.getMyLessonNoteSubjects).mockResolvedValue([
        { levelId: "level-1", levelName: "Primary", subjectId: "subject-1", subjectName: "Mathematics", authorable: false },
      ]);
      vi.mocked(lessonNotesApi.getWeekGrid).mockResolvedValue([
        { weekNumber: 1, weekStart: "2026-09-01", weekEnd: "2026-09-05", noteId: null, topic: null, status: null },
      ]);
      renderAs("TEACHER", "/?subjectId=subject-1");

      expect(await screen.findByText(/you can read its lesson notes but not edit them/)).toBeInTheDocument();
      // An empty week of a read-only subject isn't a clickable row (no blank editor to open).
      expect((await screen.findByText("Week 1")).closest("tr")).not.toHaveAttribute("tabindex");
      expect(screen.queryByRole("button", { name: "Copy from another term" })).not.toBeInTheDocument();
    });

    it("shows the copy trigger once a current term is auto-selected, and opens the copy modal", async () => {
      renderAs("TEACHER");
      const user = userEvent.setup();

      const trigger = await screen.findByRole("button", { name: "Copy from another term" });
      await user.click(trigger);

      expect(await screen.findByText("Copy from another term", { selector: "h2, [role=heading]" })).toBeInTheDocument();
      expect(screen.getByText("Subjects to copy")).toBeInTheDocument();
    });

    it("submits a copy and renders a copied/skipped outcome row", async () => {
      const PRIOR_TERM = { id: "term-0", schoolId: "school-1", sessionId: "session-1", termNumber: 1, name: "Zeroth Term", startDate: "2026-01-01", endDate: "2026-04-01", current: false };
      vi.mocked(sessionsApi.listTerms).mockResolvedValue([PRIOR_TERM, CURRENT_TERM]);
      vi.mocked(lessonNotesApi.copyLessonNotes).mockResolvedValue({
        outcomes: [
          { subjectId: "subject-1", subjectName: "Mathematics", success: true, copied: 2, skipped: 1, message: null },
        ],
      });
      renderAs("TEACHER");
      const user = userEvent.setup();

      await user.click(await screen.findByRole("button", { name: "Copy from another term" }));
      await screen.findByText("Subjects to copy");

      await user.selectOptions(screen.getByLabelText("Source session"), "2026/2027");
      await user.selectOptions(await screen.findByLabelText("Source term"), "Zeroth Term");
      await user.click(screen.getByLabelText(/Mathematics/));
      await user.click(screen.getByRole("button", { name: /Copy note/ }));

      expect(await screen.findByText(/1 skipped/)).toBeInTheDocument();
      // No branchId for a TEACHER - the server confines them to their own branch.
      expect(lessonNotesApi.copyLessonNotes).toHaveBeenCalledWith("term-0", "term-1", ["subject-1"], undefined);
    });
  });
});

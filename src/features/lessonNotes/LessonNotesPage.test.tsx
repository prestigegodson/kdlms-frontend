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
import { resetLevelStore } from "@/stores/levelStore";

vi.mock("@/api/lessonNotes", async () => {
  const actual = await vi.importActual<typeof import("@/api/lessonNotes")>("@/api/lessonNotes");
  return {
    ...actual,
    getMyLessonNoteSubjects: vi.fn(),
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

function renderAs(role: "TEACHER" | "SCHOOL_ADMIN") {
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
    initialEntries: ["/"],
  });
  render(<RouterProvider router={router} />);
}

describe("LessonNotesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetLevelStore();
    vi.mocked(lessonNotesApi.getMyLessonNoteSubjects).mockResolvedValue([]);
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
        { levelId: "level-1", levelName: "Primary", subjectId: "subject-1", subjectName: "Mathematics" },
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
      expect(lessonNotesApi.copyLessonNotes).toHaveBeenCalledWith("term-0", "term-1", ["subject-1"]);
    });
  });
});

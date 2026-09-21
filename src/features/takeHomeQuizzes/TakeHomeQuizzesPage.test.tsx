import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as classesApi from "@/api/classes";
import * as meApi from "@/api/me";
import * as sessionsApi from "@/api/sessions";
import * as takeHomeQuizzesApi from "@/api/takeHomeQuizzes";
import { TakeHomeQuizzesPage } from "@/features/takeHomeQuizzes/TakeHomeQuizzesPage";
import { resetAuthStore, useAuthStore } from "@/stores/authStore";
import { resetBranchStore, useBranchStore } from "@/stores/branchStore";
import { resetFeatureStore, useFeatureStore } from "@/stores/featureStore";

vi.mock("@/api/takeHomeQuizzes", async () => {
  const actual = await vi.importActual<typeof import("@/api/takeHomeQuizzes")>("@/api/takeHomeQuizzes");
  return { ...actual, listTakeHomeQuizzes: vi.fn(), getAuthorableSubjects: vi.fn() };
});

vi.mock("@/api/me", async () => {
  const actual = await vi.importActual<typeof import("@/api/me")>("@/api/me");
  return { ...actual, listMyClasses: vi.fn() };
});

vi.mock("@/api/classes", async () => {
  const actual = await vi.importActual<typeof import("@/api/classes")>("@/api/classes");
  return { ...actual, listClasses: vi.fn() };
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
  const router = createMemoryRouter([{ path: "/", element: <TakeHomeQuizzesPage /> }], {
    initialEntries: [initialEntry],
  });
  render(<RouterProvider router={router} />);
}

describe("TakeHomeQuizzesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetBranchStore();
    resetFeatureStore();
    useFeatureStore.setState({ takeHomeQuiz: true });
    vi.mocked(meApi.listMyClasses).mockResolvedValue([]);
    vi.mocked(classesApi.listClasses).mockResolvedValue({
      content: [],
      totalElements: 0,
      totalPages: 0,
      number: 0,
      size: 200,
    });
    vi.mocked(sessionsApi.listSessions).mockResolvedValue({
      content: [],
      totalElements: 0,
      totalPages: 0,
      number: 0,
      size: 50,
    });
    vi.mocked(sessionsApi.listTerms).mockResolvedValue([]);
    vi.mocked(takeHomeQuizzesApi.getAuthorableSubjects).mockResolvedValue([]);
    vi.mocked(takeHomeQuizzesApi.listTakeHomeQuizzes).mockResolvedValue({
      content: [],
      totalElements: 0,
      totalPages: 0,
      number: 0,
      size: 20,
    });
  });

  it("shows the no-classes-assigned empty state for a TEACHER with no assignments", async () => {
    renderAs("TEACHER");

    expect(await screen.findByText("No classes assigned yet")).toBeInTheDocument();
    expect(meApi.listMyClasses).toHaveBeenCalled();
    expect(classesApi.listClasses).not.toHaveBeenCalled();
  });

  it("lists a TEACHER's quizzes once a class and term are selected", async () => {
    vi.mocked(meApi.listMyClasses).mockResolvedValue([
      { classId: "class-1", className: "JSS 1A", branchId: "branch-1", levelId: "level-1", isClassTeacher: true, subjectIds: ["subject-1"] },
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
    vi.mocked(takeHomeQuizzesApi.getAuthorableSubjects).mockResolvedValue([
      { subjectId: "subject-1", subjectName: "Mathematics" },
    ]);
    vi.mocked(takeHomeQuizzesApi.listTakeHomeQuizzes).mockResolvedValue({
      content: [
        {
          id: "quiz-1",
          title: "Week 3 quiz",
          subjectName: "Mathematics",
          className: "JSS 1A",
          quizType: "NORMAL",
          status: "DRAFT",
          availability: null,
          questionCount: 2,
          totalPoints: 4,
          opensAt: "2026-03-01T00:00:00Z",
          closesAt: "2026-03-08T00:00:00Z",
          updatedAt: "2026-03-01T00:00:00Z",
        },
      ],
      totalElements: 1,
      totalPages: 1,
      number: 0,
      size: 20,
    });

    renderAs("TEACHER");
    const user = userEvent.setup();
    await user.selectOptions(await screen.findByLabelText("Class"), "JSS 1A");

    expect(await screen.findByText("Week 3 quiz")).toBeInTheDocument();
    expect(takeHomeQuizzesApi.listTakeHomeQuizzes).toHaveBeenCalledWith(
      "class-1",
      "term-1",
      undefined,
      undefined,
      0,
      20,
    );
  });

  it("seeds the class and subject from ?classId=&subjectId= (SubjectsPage's row action)", async () => {
    vi.mocked(meApi.listMyClasses).mockResolvedValue([
      { classId: "class-1", className: "JSS 1A", branchId: "branch-1", levelId: "level-1", isClassTeacher: true, subjectIds: ["subject-1"] },
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
    vi.mocked(takeHomeQuizzesApi.getAuthorableSubjects).mockResolvedValue([
      { subjectId: "subject-1", subjectName: "Mathematics" },
    ]);

    renderAs("TEACHER", "/?classId=class-1&subjectId=subject-1");

    // No manual class/subject selection - both seed from the query string, so the list call fires
    // with the seeded pair the moment the (auto-selected) current term resolves.
    await vi.waitFor(() =>
      expect(takeHomeQuizzesApi.listTakeHomeQuizzes).toHaveBeenCalledWith(
        "class-1",
        "term-1",
        "subject-1",
        undefined,
        0,
        20,
      ),
    );
    expect(await screen.findByLabelText("Class")).toHaveValue("class-1");
    expect(screen.getByLabelText("Subject")).toHaveValue("subject-1");
  });

  it("sources classes from listClasses (school-wide, branch-filtered), not listMyClasses, for a SCHOOL_ADMIN", async () => {
    useBranchStore.setState({ status: "loaded", branches: [], selectedBranchId: null });
    renderAs("SCHOOL_ADMIN");

    await vi.waitFor(() => expect(classesApi.listClasses).toHaveBeenCalled());
    expect(meApi.listMyClasses).not.toHaveBeenCalled();
  });
});

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as takeHomeQuizzesApi from "@/api/takeHomeQuizzes";
import { TakeHomeQuizEditorPage } from "@/features/takeHomeQuizzes/TakeHomeQuizEditorPage";
import { TAKE_HOME_QUIZ_FIELD_HELP } from "@/features/takeHomeQuizzes/takeHomeQuizFieldHelp";
import { resetAuthStore, useAuthStore } from "@/stores/authStore";

vi.mock("@/api/takeHomeQuizzes", async () => {
  const actual = await vi.importActual<typeof import("@/api/takeHomeQuizzes")>("@/api/takeHomeQuizzes");
  return {
    ...actual,
    createTakeHomeQuiz: vi.fn(),
    getTakeHomeQuiz: vi.fn(),
    getTakeHomeQuizValidation: vi.fn(),
    saveTakeHomeQuizQuestions: vi.fn(),
    updateTakeHomeQuiz: vi.fn(),
    publishTakeHomeQuiz: vi.fn(),
    getTakeHomeQuizLinks: vi.fn(),
    reissueTakeHomeQuizLink: vi.fn(),
    issueMissingTakeHomeQuizLinks: vi.fn(),
    exportTakeHomeQuizLinks: vi.fn(),
  };
});

function renderAt(path: string) {
  resetAuthStore();
  useAuthStore.setState({
    user: {
      id: "user-1",
      email: "teacher@school.example",
      firstName: "A",
      lastName: "B",
      role: "TEACHER",
      schoolId: "school-1",
    },
    accessToken: "access",
    refreshToken: "refresh",
  });
  const router = createMemoryRouter([{ path: "/school/take-home-quizzes/:quizId", element: <TakeHomeQuizEditorPage /> }], {
    initialEntries: [path],
  });
  render(<RouterProvider router={router} />);
}

const SAVED_VIEW: takeHomeQuizzesApi.TakeHomeQuizView = {
  id: "quiz-1",
  classId: "class-1",
  className: "JSS 1A",
  subjectId: "subject-1",
  subjectName: "Mathematics",
  termId: "term-1",
  title: "Week 3 quiz",
  instructions: null,
  quizType: "NORMAL",
  status: "DRAFT",
  timed: false,
  durationMinutes: null,
  opensAt: "2026-03-01T00:00:00Z",
  closesAt: "2026-03-08T00:00:00Z",
  totalPoints: 0,
  questions: [],
  actions: {
    canEditMetadata: true,
    canEditQuestions: true,
    canDelete: true,
    canPublish: true,
    canPublishResults: false,
    canUnpublishResults: false,
  },
  updatedAt: "2026-03-01T00:00:00Z",
};

// isNew short-circuits the getTakeHomeQuiz fetch, so the editable branch renders with no API mocking needed.
describe("TakeHomeQuizEditorPage - a new quiz", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows field descriptions for a new quiz", async () => {
    renderAt("/school/take-home-quizzes/new?classId=class-1&subjectId=subject-1&termId=term-1");

    expect(await screen.findByText(TAKE_HOME_QUIZ_FIELD_HELP.title)).toBeInTheDocument();
    expect(screen.getByText(TAKE_HOME_QUIZ_FIELD_HELP.instructions)).toBeInTheDocument();
  });

  it("hides the question editor and shows a save-first hint before the quiz exists", async () => {
    renderAt("/school/take-home-quizzes/new?classId=class-1&subjectId=subject-1&termId=term-1");

    expect(
      await screen.findByText("Save the quiz's details first, then add questions."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Questions")).not.toBeInTheDocument();
  });

  it("creates the quiz on Save and navigates to its real id", async () => {
    vi.mocked(takeHomeQuizzesApi.createTakeHomeQuiz).mockResolvedValue(SAVED_VIEW);
    // Once Save navigates from "new" to the freshly-minted id, isNew flips false and the
    // load-by-id effect re-fires - the same re-fetch LessonNoteEditorPage's own "new" transition
    // triggers, so this needs mocking too even though the page already has the saved view in state.
    vi.mocked(takeHomeQuizzesApi.getTakeHomeQuiz).mockResolvedValue(SAVED_VIEW);
    vi.mocked(takeHomeQuizzesApi.getTakeHomeQuizValidation).mockResolvedValue({
      canPublish: false,
      blockers: ["Add at least one question."],
      totalPoints: 0,
      midtermMax: null,
      rosterSize: 3,
    });
    renderAt("/school/take-home-quizzes/new?classId=class-1&subjectId=subject-1&termId=term-1");
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText("Title"), "Week 3 quiz");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText("Questions")).toBeInTheDocument();
    expect(takeHomeQuizzesApi.createTakeHomeQuiz).toHaveBeenCalledWith(
      expect.objectContaining({ classId: "class-1", subjectId: "subject-1", termId: "term-1", title: "Week 3 quiz" }),
    );
  });
});

describe("TakeHomeQuizEditorPage - an existing quiz", () => {
  beforeEach(() => vi.clearAllMocks());

  it("loads and shows the saved title, with the question editor available", async () => {
    vi.mocked(takeHomeQuizzesApi.getTakeHomeQuiz).mockResolvedValue(SAVED_VIEW);
    vi.mocked(takeHomeQuizzesApi.getTakeHomeQuizValidation).mockResolvedValue({
      canPublish: false,
      blockers: ["Add at least one question."],
      totalPoints: 0,
      midtermMax: null,
      rosterSize: 3,
    });

    renderAt("/school/take-home-quizzes/quiz-1?classId=class-1&subjectId=subject-1&termId=term-1");

    expect(await screen.findByDisplayValue("Week 3 quiz")).toBeInTheDocument();
    expect(screen.getByText("Add question")).toBeInTheDocument();
    // findBy, not getBy - the validation fetch resolves on its own effect, a tick after the quiz load does.
    expect(await screen.findByText("Add at least one question.")).toBeInTheDocument();
  });

  it("disables the form when the server reports the quiz isn't editable", async () => {
    vi.mocked(takeHomeQuizzesApi.getTakeHomeQuiz).mockResolvedValue({
      ...SAVED_VIEW,
      status: "RESULTS_PUBLISHED",
      actions: {
        canEditMetadata: false,
        canEditQuestions: false,
        canDelete: false,
        canPublish: false,
        canPublishResults: false,
        canUnpublishResults: true,
      },
    });
    vi.mocked(takeHomeQuizzesApi.getTakeHomeQuizValidation).mockResolvedValue({
      canPublish: true,
      blockers: [],
      totalPoints: 4,
      midtermMax: null,
      rosterSize: 3,
    });
    // Status !== DRAFT renders StudentLinksPanel, which fetches on mount.
    vi.mocked(takeHomeQuizzesApi.getTakeHomeQuizLinks).mockResolvedValue([]);

    renderAt("/school/take-home-quizzes/quiz-1?classId=class-1&subjectId=subject-1&termId=term-1");

    const title = await screen.findByLabelText("Title");
    expect(title).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Save changes" })).not.toBeInTheDocument();
    expect(screen.queryByText("Delete")).not.toBeInTheDocument();
    expect(screen.queryByText("Publish")).not.toBeInTheDocument();
  });

  it("shows the Publish action only when the server reports the quiz publishable", async () => {
    vi.mocked(takeHomeQuizzesApi.getTakeHomeQuiz).mockResolvedValue(SAVED_VIEW);
    vi.mocked(takeHomeQuizzesApi.getTakeHomeQuizValidation).mockResolvedValue({
      canPublish: false,
      blockers: ["Add at least one question."],
      totalPoints: 0,
      midtermMax: null,
      rosterSize: 3,
    });

    renderAt("/school/take-home-quizzes/quiz-1?classId=class-1&subjectId=subject-1&termId=term-1");

    expect(await screen.findByDisplayValue("Week 3 quiz")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Publish" })).toBeInTheDocument();
  });
});

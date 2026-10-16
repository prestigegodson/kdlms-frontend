import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as quizThemesApi from "@/api/quizThemes";
import * as takeHomeQuizzesApi from "@/api/takeHomeQuizzes";
import { TakeHomeQuizEditorPage } from "@/features/takeHomeQuizzes/TakeHomeQuizEditorPage";
import { TAKE_HOME_QUIZ_FIELD_HELP } from "@/features/takeHomeQuizzes/takeHomeQuizFieldHelp";
import { resetAuthStore, useAuthStore } from "@/stores/authStore";
import { pickSubject } from "@/test/subjectPicker";

vi.mock("@/api/takeHomeQuizzes", async () => {
  const actual = await vi.importActual<typeof import("@/api/takeHomeQuizzes")>("@/api/takeHomeQuizzes");
  return {
    ...actual,
    createTakeHomeQuiz: vi.fn(),
    getShareableClasses: vi.fn().mockResolvedValue([]),
    getTakeHomeQuiz: vi.fn(),
    getTakeHomeQuizValidation: vi.fn(),
    saveTakeHomeQuizQuestions: vi.fn(),
    updateTakeHomeQuiz: vi.fn(),
    publishTakeHomeQuiz: vi.fn(),
    getTakeHomeQuizLinks: vi.fn(),
    reissueTakeHomeQuizLink: vi.fn(),
    issueMissingTakeHomeQuizLinks: vi.fn(),
    exportTakeHomeQuizLinks: vi.fn(),
    getQuizShareTargets: vi.fn(),
    getQuizShareTargetSubjects: vi.fn(),
    shareTakeHomeQuiz: vi.fn(),
  };
});

const OCEAN_STYLE: quizThemesApi.QuizThemeStyle = vi.hoisted(() => ({
  backgroundKind: "GRADIENT" as const,
  backgroundColor: "#0ea5e9",
  backgroundColor2: "#1e3a8a",
  gradientAngle: 160,
  backgroundImageFileId: null,
  backgroundImageFit: null,
  headerImageFileId: null,
  accentColor: "#0369a1",
  font: "NUNITO" as const,
  cardOpacity: 100,
  cardRadius: "LARGE" as const,
}));

vi.mock("@/api/quizThemes", () => ({
  listQuizThemes: vi.fn().mockResolvedValue({
    presets: [{ key: "ocean", name: "Ocean", style: OCEAN_STYLE }],
    themes: [],
  }),
  createQuizTheme: vi.fn(),
  updateQuizTheme: vi.fn(),
  deleteQuizTheme: vi.fn(),
}));

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
  revealResultsOnSubmit: false,
  shuffleQuestions: false,
  shuffleChoices: false,
  totalPoints: 0,
  questions: [],
  actions: {
    canEditMetadata: true,
    canEditQuestions: true,
    canDelete: true,
    canPublish: true,
    canPublishResults: false,
    canUnpublishResults: false,
    canShare: false,
  },
  updatedAt: "2026-03-01T00:00:00Z",
  subjectGroupId: null,
  writable: true,
  classes: [{ classId: "class-1", className: "JSS 1A" }],
  themeId: null,
  themePreset: null,
  theme: null,
};

const ARMS: takeHomeQuizzesApi.SharedClassView[] = [
  { classId: "class-1", className: "JSS 1A" },
  { classId: "class-2", className: "JSS 1B" },
];

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
      portalRosterSize: 0,
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

  it("sends the shuffle toggles with the quiz's details", async () => {
    vi.mocked(takeHomeQuizzesApi.createTakeHomeQuiz).mockResolvedValue(SAVED_VIEW);
    vi.mocked(takeHomeQuizzesApi.getTakeHomeQuiz).mockResolvedValue(SAVED_VIEW);
    vi.mocked(takeHomeQuizzesApi.getTakeHomeQuizValidation).mockResolvedValue({
      canPublish: false,
      blockers: ["Add at least one question."],
      totalPoints: 0,
      midtermMax: null,
      rosterSize: 3,
      portalRosterSize: 0,
    });
    renderAt("/school/take-home-quizzes/new?classId=class-1&subjectId=subject-1&termId=term-1");
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText("Title"), "Week 3 quiz");
    await user.click(screen.getByLabelText("Shuffle question order"));
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText("Questions")).toBeInTheDocument();
    expect(takeHomeQuizzesApi.createTakeHomeQuiz).toHaveBeenCalledWith(
      expect.objectContaining({ shuffleQuestions: true, shuffleChoices: false }),
    );
  });

  it("creates a subject-group quiz from ?subjectGroupId= and offers only the Normal quiz type", async () => {
    const groupView = { ...SAVED_VIEW, subjectId: null, subjectGroupId: "group-1", subjectName: "Sciences" };
    vi.mocked(takeHomeQuizzesApi.createTakeHomeQuiz).mockResolvedValue(groupView);
    vi.mocked(takeHomeQuizzesApi.getTakeHomeQuiz).mockResolvedValue(groupView);
    vi.mocked(takeHomeQuizzesApi.getTakeHomeQuizValidation).mockResolvedValue({
      canPublish: false,
      blockers: ["Add at least one question."],
      totalPoints: 0,
      midtermMax: null,
      rosterSize: 3,
      portalRosterSize: 0,
    });
    renderAt("/school/take-home-quizzes/new?classId=class-1&subjectGroupId=group-1&termId=term-1");
    const user = userEvent.setup();

    const quizType = await screen.findByLabelText("Quiz type");
    expect(quizType).toBeDisabled();
    expect(screen.queryByRole("option", { name: "Midterm" })).not.toBeInTheDocument();

    await user.type(screen.getByLabelText("Title"), "Sciences quiz");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText("Questions")).toBeInTheDocument();
    expect(takeHomeQuizzesApi.createTakeHomeQuiz).toHaveBeenCalledWith(
      expect.objectContaining({ classId: "class-1", subjectId: null, subjectGroupId: "group-1", quizType: "NORMAL" }),
    );
  });
});

describe("TakeHomeQuizEditorPage - sharing with other classes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(takeHomeQuizzesApi.getShareableClasses).mockResolvedValue(ARMS);
  });

  it("shares a new Normal quiz with the ticked arms, the home class always included", async () => {
    const sharedView = { ...SAVED_VIEW, classes: ARMS };
    vi.mocked(takeHomeQuizzesApi.createTakeHomeQuiz).mockResolvedValue(sharedView);
    vi.mocked(takeHomeQuizzesApi.getTakeHomeQuiz).mockResolvedValue(sharedView);
    vi.mocked(takeHomeQuizzesApi.getTakeHomeQuizValidation).mockResolvedValue({
      canPublish: false,
      blockers: [],
      totalPoints: 0,
      midtermMax: null,
      rosterSize: 6,
      portalRosterSize: 0,
    });
    renderAt("/school/take-home-quizzes/new?classId=class-1&subjectId=subject-1&termId=term-1");
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: /Share with other classrooms|Change classrooms/ }));
    const home = screen.getByLabelText(/^JSS 1A/);
    expect(home).toBeChecked();
    expect(home).toBeDisabled();
    await user.click(screen.getByLabelText("JSS 1B"));
    expect(screen.getByRole("option", { name: "Midterm" })).toBeEnabled();

    await user.type(screen.getByLabelText("Title"), "Shared quiz");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText("Questions")).toBeInTheDocument();
    expect(takeHomeQuizzesApi.createTakeHomeQuiz).toHaveBeenCalledWith(
      expect.objectContaining({ classIds: ["class-1", "class-2"] }),
    );
  });

  it("shares a new Midterm quiz with the ticked arms", async () => {
    vi.mocked(takeHomeQuizzesApi.createTakeHomeQuiz).mockResolvedValue({
      ...SAVED_VIEW,
      quizType: "MIDTERM",
      classes: ARMS,
    });
    renderAt("/school/take-home-quizzes/new?classId=class-1&subjectId=subject-1&termId=term-1");
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: /Share with other classrooms|Change classrooms/ }));
    await user.click(screen.getByLabelText("JSS 1B"));
    await user.selectOptions(screen.getByLabelText("Quiz type"), "MIDTERM");
    expect(screen.getByLabelText("JSS 1B")).toBeChecked();

    await user.type(screen.getByLabelText("Title"), "Shared midterm");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(takeHomeQuizzesApi.createTakeHomeQuiz).toHaveBeenCalledWith(
        expect.objectContaining({ quizType: "MIDTERM", classIds: ["class-1", "class-2"] }),
      ),
    );
  });

  it("shows another arm's teacher a read-only notice and no class picker", async () => {
    vi.mocked(takeHomeQuizzesApi.getTakeHomeQuiz).mockResolvedValue({
      ...SAVED_VIEW,
      classes: ARMS,
      writable: false,
      actions: {
        canEditMetadata: false,
        canEditQuestions: false,
        canDelete: false,
        canPublish: false,
        canPublishResults: false,
        canUnpublishResults: false,
        canShare: false,
      },
    });
    vi.mocked(takeHomeQuizzesApi.getTakeHomeQuizValidation).mockResolvedValue({
      canPublish: false,
      blockers: [],
      totalPoints: 0,
      midtermMax: null,
      rosterSize: 6,
      portalRosterSize: 0,
    });

    renderAt("/school/take-home-quizzes/quiz-1?classId=class-2&subjectId=subject-1&termId=term-1");

    expect(await screen.findByText(/shared with your class from JSS 1A/)).toBeInTheDocument();
    expect(screen.queryByLabelText("JSS 1B")).not.toBeInTheDocument();
    expect(takeHomeQuizzesApi.getShareableClasses).not.toHaveBeenCalled();
  });
});

describe("TakeHomeQuizEditorPage - an existing quiz", () => {
  beforeEach(() => vi.clearAllMocks());

  it("applies a built-in theme from the gallery and sends it with the next save", async () => {
    const user = userEvent.setup();
    vi.mocked(takeHomeQuizzesApi.getTakeHomeQuiz).mockResolvedValue(SAVED_VIEW);
    vi.mocked(takeHomeQuizzesApi.getTakeHomeQuizValidation).mockResolvedValue({
      canPublish: false,
      blockers: [],
      totalPoints: 0,
      midtermMax: null,
      rosterSize: 3,
      portalRosterSize: 0,
    });
    vi.mocked(takeHomeQuizzesApi.updateTakeHomeQuiz).mockResolvedValue({
      ...SAVED_VIEW,
      themePreset: "ocean",
      theme: OCEAN_STYLE,
    });

    renderAt("/school/take-home-quizzes/quiz-1?classId=class-1&subjectId=subject-1&termId=term-1");

    await user.click(await screen.findByRole("button", { name: "Choose theme" }));
    await user.click(await screen.findByRole("button", { name: "Use Ocean" }));
    expect(await screen.findByText("Built-in theme")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(takeHomeQuizzesApi.updateTakeHomeQuiz).toHaveBeenCalledWith(
      "quiz-1",
      expect.objectContaining({ themeId: null, themePreset: "ocean" }),
    );
  });

  it("scrolls up to a success notice after saving, hidden again by the next edit", async () => {
    const user = userEvent.setup();
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    vi.mocked(takeHomeQuizzesApi.getTakeHomeQuiz).mockResolvedValue(SAVED_VIEW);
    vi.mocked(takeHomeQuizzesApi.getTakeHomeQuizValidation).mockResolvedValue({
      canPublish: false,
      blockers: [],
      totalPoints: 0,
      midtermMax: null,
      rosterSize: 3,
      portalRosterSize: 0,
    });
    vi.mocked(takeHomeQuizzesApi.updateTakeHomeQuiz).mockResolvedValue({ ...SAVED_VIEW, title: "Week 4 quiz" });

    renderAt("/school/take-home-quizzes/quiz-1?classId=class-1&subjectId=subject-1&termId=term-1");

    const title = await screen.findByDisplayValue("Week 3 quiz");
    await user.clear(title);
    await user.type(title, "Week 4 quiz");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText("Quiz saved.")).toBeInTheDocument();
    expect(scrollIntoView).toHaveBeenCalled();

    await user.type(screen.getByDisplayValue("Week 4 quiz"), "!");
    expect(screen.queryByText("Quiz saved.")).not.toBeInTheDocument();
  });

  it("scrolls up to the error when a save fails", async () => {
    const user = userEvent.setup();
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    vi.mocked(takeHomeQuizzesApi.getTakeHomeQuiz).mockResolvedValue(SAVED_VIEW);
    vi.mocked(takeHomeQuizzesApi.getTakeHomeQuizValidation).mockResolvedValue({
      canPublish: false,
      blockers: [],
      totalPoints: 0,
      midtermMax: null,
      rosterSize: 3,
      portalRosterSize: 0,
    });
    vi.mocked(takeHomeQuizzesApi.updateTakeHomeQuiz).mockRejectedValue(new Error("boom"));

    renderAt("/school/take-home-quizzes/quiz-1?classId=class-1&subjectId=subject-1&termId=term-1");

    await user.type(await screen.findByDisplayValue("Week 3 quiz"), "!");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText("Failed to save this quiz")).toBeInTheDocument();
    expect(screen.queryByText("Quiz saved.")).not.toBeInTheDocument();
    expect(scrollIntoView).toHaveBeenCalled();
  });

  it("loads and shows the saved title, with the question editor available", async () => {
    vi.mocked(takeHomeQuizzesApi.getTakeHomeQuiz).mockResolvedValue(SAVED_VIEW);
    vi.mocked(takeHomeQuizzesApi.getTakeHomeQuizValidation).mockResolvedValue({
      canPublish: false,
      blockers: ["Add at least one question."],
      totalPoints: 0,
      midtermMax: null,
      rosterSize: 3,
      portalRosterSize: 0,
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
        canShare: false,
      },
    });
    vi.mocked(takeHomeQuizzesApi.getTakeHomeQuizValidation).mockResolvedValue({
      canPublish: true,
      blockers: [],
      totalPoints: 4,
      midtermMax: null,
      rosterSize: 3,
      portalRosterSize: 0,
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

  it("locks title/instructions once a submission exists, but keeps closesAt and the reveal checkbox editable", async () => {
    vi.mocked(takeHomeQuizzesApi.getTakeHomeQuiz).mockResolvedValue({
      ...SAVED_VIEW,
      status: "PUBLISHED",
      actions: {
        canEditMetadata: true,
        canEditQuestions: false,
        canDelete: false,
        canPublish: true,
        canPublishResults: true,
        canUnpublishResults: false,
        canShare: false,
      },
    });
    vi.mocked(takeHomeQuizzesApi.getTakeHomeQuizValidation).mockResolvedValue({
      canPublish: true,
      blockers: [],
      totalPoints: 4,
      midtermMax: null,
      rosterSize: 3,
      portalRosterSize: 0,
    });
    vi.mocked(takeHomeQuizzesApi.getTakeHomeQuizLinks).mockResolvedValue([]);

    renderAt("/school/take-home-quizzes/quiz-1?classId=class-1&subjectId=subject-1&termId=term-1");

    expect(
      await screen.findByText(/Pupils have already submitted this quiz/),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Title")).toBeDisabled();
    expect(screen.getByLabelText("Instructions")).toBeDisabled();
    const revealCheckbox = screen.getByRole("checkbox", {
      name: "Show pupils their score and correct answers after they submit",
    });
    expect(revealCheckbox).not.toBeDisabled();
    expect(screen.getByLabelText("Closes time")).not.toBeDisabled();
  });

  it("shows the Publish action only when the server reports the quiz publishable", async () => {
    vi.mocked(takeHomeQuizzesApi.getTakeHomeQuiz).mockResolvedValue(SAVED_VIEW);
    vi.mocked(takeHomeQuizzesApi.getTakeHomeQuizValidation).mockResolvedValue({
      canPublish: false,
      blockers: ["Add at least one question."],
      totalPoints: 0,
      midtermMax: null,
      rosterSize: 3,
      portalRosterSize: 0,
    });

    renderAt("/school/take-home-quizzes/quiz-1?classId=class-1&subjectId=subject-1&termId=term-1");

    expect(await screen.findByDisplayValue("Week 3 quiz")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Publish" })).toBeInTheDocument();
  });
});

describe("TakeHomeQuizEditorPage - sharing a copy with another class", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(takeHomeQuizzesApi.getTakeHomeQuizValidation).mockResolvedValue({
      canPublish: true,
      blockers: [],
      totalPoints: 1,
      midtermMax: null,
      rosterSize: 3,
      portalRosterSize: 0,
    });
  });

  it("offers Share to another class only when the server allows it", async () => {
    vi.mocked(takeHomeQuizzesApi.getTakeHomeQuiz).mockResolvedValue(SAVED_VIEW);

    renderAt("/school/take-home-quizzes/quiz-1?classId=class-1&subjectId=subject-1&termId=term-1");

    expect(await screen.findByDisplayValue("Week 3 quiz")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Share to another class" })).not.toBeInTheDocument();
  });

  it("sends the saved quiz to the chosen classrooms and reports the outcome", async () => {
    const user = userEvent.setup();
    vi.mocked(takeHomeQuizzesApi.getTakeHomeQuiz).mockResolvedValue({
      ...SAVED_VIEW,
      actions: { ...SAVED_VIEW.actions, canShare: true },
    });
    vi.mocked(takeHomeQuizzesApi.getQuizShareTargets).mockResolvedValue([
      {
        levelId: "level-jss2",
        levelName: "JSS 2",
        classrooms: [
          { classId: "class-2a", className: "JSS 2A", alreadyShared: false },
          { classId: "class-2b", className: "JSS 2B", alreadyShared: false },
        ],
      },
    ]);
    vi.mocked(takeHomeQuizzesApi.getQuizShareTargetSubjects).mockResolvedValue({
      subjects: [{ subjectId: "subject-jss2-math", subjectName: "Mathematics" }],
      subjectGroups: [],
    });
    vi.mocked(takeHomeQuizzesApi.shareTakeHomeQuiz).mockResolvedValue({
      quizId: "copy-1",
      classes: [
        { classId: "class-2a", className: "JSS 2A" },
        { classId: "class-2b", className: "JSS 2B" },
      ],
      tokensMinted: 4,
      guardiansNotified: 3,
    });

    renderAt("/school/take-home-quizzes/quiz-1?classId=class-1&subjectId=subject-1&termId=term-1");

    await user.click(await screen.findByRole("button", { name: "Share to another class" }));
    // The only target class is pre-picked, with every open classroom ticked.
    expect(await screen.findByRole("checkbox", { name: "JSS 2A" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "JSS 2B" })).toBeChecked();
    await pickSubject(user, "Mathematics");
    await user.click(screen.getByRole("button", { name: "Share" }));

    expect(takeHomeQuizzesApi.shareTakeHomeQuiz).toHaveBeenCalledWith("quiz-1", {
      levelId: "level-jss2",
      classIds: ["class-2a", "class-2b"],
      subjectId: "subject-jss2-math",
      subjectGroupId: null,
    });
    expect(
      await screen.findByText('Shared "Week 3 quiz" with JSS 2A, JSS 2B and published it. 3 guardians emailed.'),
    ).toBeInTheDocument();
  });

  it("lets a Midterm quiz go to several classrooms, under a subject that takes a midterm score", async () => {
    const user = userEvent.setup();
    vi.mocked(takeHomeQuizzesApi.getTakeHomeQuiz).mockResolvedValue({
      ...SAVED_VIEW,
      quizType: "MIDTERM",
      actions: { ...SAVED_VIEW.actions, canShare: true },
    });
    vi.mocked(takeHomeQuizzesApi.getQuizShareTargets).mockResolvedValue([
      {
        levelId: "level-jss2",
        levelName: "JSS 2",
        classrooms: [
          { classId: "class-2a", className: "JSS 2A", alreadyShared: false },
          { classId: "class-2b", className: "JSS 2B", alreadyShared: false },
        ],
      },
    ]);
    vi.mocked(takeHomeQuizzesApi.getQuizShareTargetSubjects).mockResolvedValue({ subjects: [], subjectGroups: [] });

    renderAt("/school/take-home-quizzes/quiz-1?classId=class-1&subjectId=subject-1&termId=term-1");

    await user.click(await screen.findByRole("button", { name: "Share to another class" }));
    const roomA = await screen.findByRole("checkbox", { name: "JSS 2A" });
    const roomB = screen.getByRole("checkbox", { name: "JSS 2B" });
    expect(roomA).toBeChecked();
    expect(roomB).toBeChecked();
    expect(await screen.findByText("No subject in this class can take a midterm score.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Share" })).toBeDisabled();
  });
});

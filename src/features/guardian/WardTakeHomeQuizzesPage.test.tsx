import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as wardsApi from "@/api/wards";
import { WardTakeHomeQuizzesPage } from "@/features/guardian/WardTakeHomeQuizzesPage";
import { resetAuthStore, useAuthStore } from "@/stores/authStore";
import { resetFeatureStore } from "@/stores/featureStore";
import { resetWardStore } from "@/stores/wardStore";

vi.mock("@/api/wards", async () => {
  const actual = await vi.importActual<typeof import("@/api/wards")>("@/api/wards");
  return {
    ...actual,
    listMyWards: vi.fn(),
    listWardTerms: vi.fn(),
    getWardTakeHomeQuizzes: vi.fn(),
    getWardTakeHomeQuiz: vi.fn(),
  };
});

const WARD = {
  studentId: "s1",
  fullName: "Ada Obi",
  admissionNumber: "SCH/2026/0001",
  relationship: "MOTHER",
  gender: "FEMALE" as const,
  currentClassName: "Primary 3",
  status: "ACTIVE",
  schoolId: "school-1",
  schoolName: "Bright Star Academy",
};

const TERM = {
  sessionId: "session-1",
  sessionName: "2026/2027",
  currentSession: true,
  termId: "term-1",
  termName: "First Term",
  termNumber: 1,
  classId: "class-1",
  className: "Primary 3",
  resultsPublished: true,
  midtermPublished: false,
};

const SUBMITTED_MIDTERM_QUIZ = {
  id: "quiz-1",
  title: "Fractions checkpoint",
  subjectName: "Mathematics",
  quizType: "MIDTERM" as const,
  score: 18,
  totalPoints: 20,
  submitted: true,
  countsTowardMidterm: true,
  closesAt: "2026-09-14T23:00:00Z",
};

const NOT_SUBMITTED_NORMAL_QUIZ = {
  id: "quiz-2",
  title: "Vocabulary practice",
  subjectName: "English",
  quizType: "NORMAL" as const,
  score: null,
  totalPoints: 10,
  submitted: false,
  countsTowardMidterm: false,
  closesAt: "2026-09-20T23:00:00Z",
};

const QUIZ_DETAIL = {
  ...SUBMITTED_MIDTERM_QUIZ,
  instructions: "Answer every question.",
  className: "Primary 3",
  resultsPublishedAt: "2026-09-15T09:00:00Z",
};

function renderPage() {
  resetAuthStore();
  useAuthStore.setState({
    user: {
      id: "guardian-1",
      email: "guardian@example.com",
      firstName: "Gina",
      lastName: "G",
      role: "GUARDIAN",
      schoolId: "school-1",
    },
    accessToken: "access",
    refreshToken: "refresh",
  });
  const router = createMemoryRouter([{ path: "/", element: <WardTakeHomeQuizzesPage /> }], { initialEntries: ["/"] });
  render(<RouterProvider router={router} />);
}

describe("WardTakeHomeQuizzesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetWardStore();
    resetFeatureStore();
    vi.mocked(wardsApi.listWardTerms).mockResolvedValue([TERM]);
    vi.mocked(wardsApi.getWardTakeHomeQuizzes).mockResolvedValue([SUBMITTED_MIDTERM_QUIZ, NOT_SUBMITTED_NORMAL_QUIZ]);
    vi.mocked(wardsApi.getWardTakeHomeQuiz).mockResolvedValue(QUIZ_DETAIL);
  });

  it("shows an empty state when the guardian has no linked wards", async () => {
    vi.mocked(wardsApi.listMyWards).mockResolvedValue([]);

    renderPage();

    expect(await screen.findByText("No wards linked yet")).toBeInTheDocument();
  });

  it("shows a retryable error state when the ward list fails to load", async () => {
    vi.mocked(wardsApi.listMyWards).mockRejectedValueOnce(new Error("network down")).mockResolvedValue([WARD]);
    const user = userEvent.setup();

    renderPage();

    expect(await screen.findByRole("button", { name: "Try again" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByText("Fractions checkpoint")).toBeInTheDocument();
  });

  it("shows an empty state when the ward has no take-home quiz results yet", async () => {
    vi.mocked(wardsApi.listMyWards).mockResolvedValue([WARD]);
    vi.mocked(wardsApi.getWardTakeHomeQuizzes).mockResolvedValue([]);

    renderPage();

    expect(await screen.findByText("No take-home quiz results yet")).toBeInTheDocument();
  });

  it("shows a submitted quiz's score and its midterm badge", async () => {
    vi.mocked(wardsApi.listMyWards).mockResolvedValue([WARD]);

    renderPage();

    expect(await screen.findByText("Fractions checkpoint")).toBeInTheDocument();
    expect(screen.getByText("18 / 20")).toBeInTheDocument();
    expect(screen.getByText("Counts toward midterm")).toBeInTheDocument();
    expect(screen.getByText("Submitted")).toBeInTheDocument();
  });

  it("shows a non-submitted quiz with no score", async () => {
    vi.mocked(wardsApi.listMyWards).mockResolvedValue([WARD]);

    renderPage();

    expect(await screen.findByText("Vocabulary practice")).toBeInTheDocument();
    expect(screen.getByText("Not submitted")).toBeInTheDocument();
  });

  it("opens a quiz's result detail when its row is tapped", async () => {
    vi.mocked(wardsApi.listMyWards).mockResolvedValue([WARD]);
    const user = userEvent.setup();

    renderPage();
    await screen.findByText("Fractions checkpoint");
    await user.click(screen.getByText("Fractions checkpoint"));

    expect(await screen.findByText("Answer every question.")).toBeInTheDocument();
    expect(screen.getByText(/This quiz counts toward the midterm quiz score\./)).toBeInTheDocument();
  });
});

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as classQuizzesApi from "@/api/classTakeHomeQuizzes";
import type { MyQuizInterstitialView } from "@/api/myTakeHomeQuizzes";
import { LearnerClassQuizPage } from "./LearnerClassQuizPage";

vi.mock("@/api/classTakeHomeQuizzes", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/api/classTakeHomeQuizzes")>()),
  getLearnerClassQuiz: vi.fn(),
  startLearnerClassQuiz: vi.fn(),
  getMemberClassQuizReview: vi.fn(),
  saveLearnerClassQuizAnswers: vi.fn(),
  submitLearnerClassQuiz: vi.fn(),
  downloadClassQuizImage: vi.fn(),
}));

const INTERSTITIAL: MyQuizInterstitialView = {
  id: "q1",
  title: "Fractions check",
  subjectName: "Mathematics",
  className: "Maths",
  teacherName: "Ada Tutor",
  questionCount: 1,
  totalPoints: 2,
  timed: false,
  durationMinutes: null,
  opensAt: "2026-10-04T09:00:00Z",
  closesAt: "2030-10-11T09:00:00Z",
  availability: "OPEN",
  attemptState: "NOT_STARTED",
  revealResults: false,
  serverTime: "2026-10-05T09:00:00Z",
};

function renderPage() {
  const router = createMemoryRouter([{ path: "/learner/quizzes/:classId/:quizId", element: <LearnerClassQuizPage /> }], {
    initialEntries: ["/learner/quizzes/c1/q1"],
  });
  render(<RouterProvider router={router} />);
}

describe("LearnerClassQuizPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the interstitial and starts the attempt through the class endpoint", async () => {
    vi.mocked(classQuizzesApi.getLearnerClassQuiz).mockResolvedValue(INTERSTITIAL);
    vi.mocked(classQuizzesApi.startLearnerClassQuiz).mockResolvedValue({
      questions: [
        {
          id: "qq1",
          position: 1,
          questionType: "SINGLE_CHOICE",
          prompt: "<p>2 + 2?</p>",
          points: 2,
          options: [
            { id: "o1", position: 1, label: "<p>4</p>" },
            { id: "o2", position: 2, label: "<p>5</p>" },
          ],
        },
      ],
      answers: {},
      deadlineAt: null,
      serverTime: "2026-10-05T09:00:00Z",
    });
    renderPage();
    const user = userEvent.setup();

    expect(await screen.findByText("Set by Ada Tutor")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Start quiz" }));

    expect(classQuizzesApi.startLearnerClassQuiz).toHaveBeenCalledWith("c1", "q1");
    expect(await screen.findByText("2 + 2?")).toBeInTheDocument();
  });

  it("shows the released result for a submitted quiz", async () => {
    vi.mocked(classQuizzesApi.getLearnerClassQuiz).mockResolvedValue({
      ...INTERSTITIAL,
      attemptState: "SUBMITTED",
      revealResults: true,
    });
    vi.mocked(classQuizzesApi.getMemberClassQuizReview).mockResolvedValue({ score: 2, totalPoints: 2, questions: [] });
    renderPage();

    await waitFor(() =>
      expect(classQuizzesApi.getMemberClassQuizReview).toHaveBeenCalledWith({ classId: "c1" }, "q1"),
    );
    expect(screen.queryByText("Quiz submitted")).not.toBeInTheDocument();
  });

  it("asks the learner to wait when the result isn't released yet", async () => {
    vi.mocked(classQuizzesApi.getLearnerClassQuiz).mockResolvedValue({ ...INTERSTITIAL, attemptState: "SUBMITTED" });
    renderPage();

    expect(await screen.findByText("Quiz submitted")).toBeInTheDocument();
    expect(classQuizzesApi.getMemberClassQuizReview).not.toHaveBeenCalled();
  });
});

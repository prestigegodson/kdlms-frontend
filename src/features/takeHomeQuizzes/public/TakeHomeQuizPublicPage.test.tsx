import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as publicApi from "@/api/publicTakeHomeQuiz";
import { ApiError } from "@/api/client";
import { TakeHomeQuizPublicPage } from "@/features/takeHomeQuizzes/public/TakeHomeQuizPublicPage";

vi.mock("@/api/publicTakeHomeQuiz");

function renderAt(path: string) {
  const router = createMemoryRouter(
    [{ path: "/take-home-quiz", element: <TakeHomeQuizPublicPage /> }],
    {
      initialEntries: [path],
    },
  );
  render(<RouterProvider router={router} />);
}

const interstitial: publicApi.QuizInterstitialView = {
  schoolName: "Test School",
  schoolLogoDataUri: null,
  quizTitle: "Week 3 quiz",
  subjectName: "Mathematics",
  className: "Primary 1",
  teacherName: "Tara Teacher",
  studentFirstName: "Ada",
  questionCount: 1,
  totalPoints: 1,
  timed: false,
  durationMinutes: null,
  closesAt: "2026-01-10T00:00:00Z",
  availability: "OPEN",
  attemptState: "NOT_STARTED",
  revealResults: false,
  serverTime: "2026-01-01T00:00:00Z",
};

const attempt: publicApi.QuizAttemptView = {
  questions: [
    {
      id: "q1",
      position: 1,
      questionType: "SINGLE_CHOICE",
      prompt: "2 + 2 = ?",
      points: 1,
      options: [
        { id: "opt-a", position: 1, label: "3" },
        { id: "opt-b", position: 2, label: "4" },
      ],
    },
  ],
  answers: {},
  deadlineAt: null,
  serverTime: "2026-01-01T00:00:00Z",
};

describe("TakeHomeQuizPublicPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows an invalid-link state and never resolves when the URL has no token", async () => {
    renderAt("/take-home-quiz");

    expect(await screen.findByText("Link not found")).toBeInTheDocument();
    expect(publicApi.resolveTakeHomeQuiz).not.toHaveBeenCalled();
  });

  it("resolves the token and renders the interstitial without starting the clock", async () => {
    vi.mocked(publicApi.resolveTakeHomeQuiz).mockResolvedValue(interstitial);
    renderAt("/take-home-quiz?token=abc123");

    expect(await screen.findByText("Week 3 quiz")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start quiz" })).toBeInTheDocument();
    expect(publicApi.resolveTakeHomeQuiz).toHaveBeenCalledWith("abc123");
    expect(publicApi.startTakeHomeQuiz).not.toHaveBeenCalled();
  });

  it("shows Resume quiz instead of Start quiz when an attempt is already in progress", async () => {
    vi.mocked(publicApi.resolveTakeHomeQuiz).mockResolvedValue({
      ...interstitial,
      attemptState: "IN_PROGRESS",
    });
    renderAt("/take-home-quiz?token=abc123");

    expect(await screen.findByRole("button", { name: "Resume quiz" })).toBeInTheDocument();
  });

  it("starts the quiz and renders the first question", async () => {
    vi.mocked(publicApi.resolveTakeHomeQuiz).mockResolvedValue(interstitial);
    vi.mocked(publicApi.startTakeHomeQuiz).mockResolvedValue(attempt);
    const user = userEvent.setup();
    renderAt("/take-home-quiz?token=abc123");

    await user.click(await screen.findByRole("button", { name: "Start quiz" }));

    expect(await screen.findByText("2 + 2 = ?")).toBeInTheDocument();
    expect(publicApi.startTakeHomeQuiz).toHaveBeenCalledWith("abc123");
  });

  it("submits and shows the confirmation", async () => {
    vi.mocked(publicApi.resolveTakeHomeQuiz).mockResolvedValue(interstitial);
    vi.mocked(publicApi.startTakeHomeQuiz).mockResolvedValue(attempt);
    vi.mocked(publicApi.submitTakeHomeQuiz).mockResolvedValue({
      alreadySubmitted: false,
      revealResults: false,
      serverTime: "2026-01-01T00:00:00Z",
    });
    const user = userEvent.setup();
    renderAt("/take-home-quiz?token=abc123");

    await user.click(await screen.findByRole("button", { name: "Start quiz" }));
    await screen.findByText("2 + 2 = ?");
    await user.click(screen.getByRole("button", { name: "Submit quiz" }));

    const dialog = await screen.findByRole("dialog", { name: "Submit quiz?" });
    await user.click(within(dialog).getByRole("button", { name: "Submit quiz" }));

    expect(await screen.findByText("Quiz submitted")).toBeInTheDocument();
    expect(publicApi.submitTakeHomeQuiz).toHaveBeenCalledWith("abc123");
  });

  it("warns about unanswered questions and lets the student jump back to one", async () => {
    vi.mocked(publicApi.resolveTakeHomeQuiz).mockResolvedValue(interstitial);
    vi.mocked(publicApi.startTakeHomeQuiz).mockResolvedValue(attempt);
    const user = userEvent.setup();
    renderAt("/take-home-quiz?token=abc123");

    await user.click(await screen.findByRole("button", { name: "Start quiz" }));
    await screen.findByText("2 + 2 = ?");
    await user.click(screen.getByRole("button", { name: "Submit quiz" }));

    const dialog = await screen.findByRole("dialog", { name: "Submit quiz?" });
    expect(within(dialog).getByText("You have 1 unanswered question")).toBeInTheDocument();
    expect(publicApi.submitTakeHomeQuiz).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole("button", { name: "1" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText("2 + 2 = ?")).toBeInTheDocument();
  });

  it("closes the confirm dialog without submitting on cancel", async () => {
    vi.mocked(publicApi.resolveTakeHomeQuiz).mockResolvedValue(interstitial);
    vi.mocked(publicApi.startTakeHomeQuiz).mockResolvedValue(attempt);
    const user = userEvent.setup();
    renderAt("/take-home-quiz?token=abc123");

    await user.click(await screen.findByRole("button", { name: "Start quiz" }));
    await screen.findByText("2 + 2 = ?");
    await user.click(screen.getByRole("button", { name: "Submit quiz" }));

    const dialog = await screen.findByRole("dialog", { name: "Submit quiz?" });
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(publicApi.submitTakeHomeQuiz).not.toHaveBeenCalled();
  });

  it("shows the submitted confirmation immediately when resolving an already-submitted attempt", async () => {
    vi.mocked(publicApi.resolveTakeHomeQuiz).mockResolvedValue({
      ...interstitial,
      attemptState: "SUBMITTED",
    });
    renderAt("/take-home-quiz?token=abc123");

    expect(await screen.findByText("Quiz submitted")).toBeInTheDocument();
    expect(publicApi.startTakeHomeQuiz).not.toHaveBeenCalled();
  });

  it("shows a distinct message when the rate limiter rejects the request", async () => {
    vi.mocked(publicApi.resolveTakeHomeQuiz).mockRejectedValue(
      new ApiError(429, "Too many requests", {
        type: "https://kdlms.com/problems/too-many-requests",
      }),
    );
    renderAt("/take-home-quiz?token=abc123");

    expect(
      await screen.findByText("Too many requests - please wait a moment and try again."),
    ).toBeInTheDocument();
  });

  it("shows the invalid-link state for a 404, matching an unknown/revoked/expired token", async () => {
    vi.mocked(publicApi.resolveTakeHomeQuiz).mockRejectedValue(
      new ApiError(404, "This quiz link is not available."),
    );
    renderAt("/take-home-quiz?token=unknown");

    expect(await screen.findByText("Link not found")).toBeInTheDocument();
  });

  it("counts down and auto-submits once the deadline passes", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const timedAttempt: publicApi.QuizAttemptView = {
      ...attempt,
      deadlineAt: "2026-01-01T00:00:05Z",
      serverTime: "2026-01-01T00:00:00Z",
    };
    vi.mocked(publicApi.resolveTakeHomeQuiz).mockResolvedValue({
      ...interstitial,
      timed: true,
      durationMinutes: 1,
    });
    vi.mocked(publicApi.startTakeHomeQuiz).mockResolvedValue(timedAttempt);
    vi.mocked(publicApi.submitTakeHomeQuiz).mockResolvedValue({
      alreadySubmitted: false,
      revealResults: false,
      serverTime: "2026-01-01T00:00:06Z",
    });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    renderAt("/take-home-quiz?token=abc123");
    await user.click(await screen.findByRole("button", { name: "Start quiz" }));
    await screen.findByText("2 + 2 = ?");

    await vi.advanceTimersByTimeAsync(6000);

    await waitFor(() => expect(publicApi.submitTakeHomeQuiz).toHaveBeenCalledWith("abc123"));
    expect(await screen.findByText("Quiz submitted")).toBeInTheDocument();
  });
});

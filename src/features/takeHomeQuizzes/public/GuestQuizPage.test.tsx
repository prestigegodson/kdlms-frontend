import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/api/client";
import * as guestApi from "@/api/guestQuiz";
import type { QuizAttemptView, QuizReviewView } from "@/api/publicTakeHomeQuiz";
import { GuestQuizPage } from "@/features/takeHomeQuizzes/public/GuestQuizPage";

vi.mock("@/api/guestQuiz");
vi.mock("@/api/auth", () => ({ getAuthConfig: () => Promise.resolve({ captchaSiteKey: null }) }));

const SESSION_KEY = "kdlms.guestQuiz.link-1";

function renderAt(path = "/take-home-quiz/guest?link=link-1") {
  const router = createMemoryRouter([{ path: "/take-home-quiz/guest", element: <GuestQuizPage /> }], {
    initialEntries: [path],
  });
  render(<RouterProvider router={router} />);
}

function notFound() {
  return new ApiError(404, "Not found");
}

const landing: guestApi.GuestQuizLandingView = {
  tutorName: "Ada's Tutoring",
  quizTitle: "Fractions check",
  className: "Maths",
  questionCount: 1,
  totalPoints: 2,
  timed: false,
  closesAt: "2030-01-10T00:00:00Z",
  availability: "OPEN",
  revealOnSubmit: false,
  serverTime: "2030-01-01T00:00:00Z",
};

const attempt: QuizAttemptView = {
  questions: [
    {
      id: "q1",
      position: 1,
      questionType: "SINGLE_CHOICE",
      prompt: "2 + 2 = ?",
      points: 2,
      options: [
        { id: "opt-a", position: 1, label: "3" },
        { id: "opt-b", position: 2, label: "4" },
      ],
    },
  ],
  answers: {},
  deadlineAt: null,
  serverTime: "2030-01-01T00:00:00Z",
};

const session: guestApi.GuestQuizSessionView = {
  guestName: "Grace Hopper",
  hasEmail: true,
  attemptState: "IN_PROGRESS",
  revealResults: false,
  quizTitle: "Fractions check",
};

describe("GuestQuizPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.mocked(guestApi.getGuestQuizLanding).mockResolvedValue(landing);
    vi.mocked(guestApi.saveGuestQuizAnswers).mockResolvedValue(attempt);
    vi.mocked(guestApi.guestQuizImageUrl).mockReturnValue("/image");
    vi.mocked(guestApi.guestQuizLinkImageUrl).mockReturnValue("/image");
  });

  it("shows an invalid-link state when the link is missing or unknown", async () => {
    renderAt("/take-home-quiz/guest");
    expect(await screen.findByText("Link not found")).toBeInTheDocument();
    expect(guestApi.getGuestQuizLanding).not.toHaveBeenCalled();
  });

  it("requires a full name before starting", async () => {
    const user = userEvent.setup();
    renderAt();

    await user.click(await screen.findByRole("button", { name: "Start quiz" }));

    expect(await screen.findByText("Enter your full name.")).toBeInTheDocument();
    expect(guestApi.startGuestQuiz).not.toHaveBeenCalled();
  });

  it("explains the email only when the quiz hides scores", async () => {
    renderAt();
    expect(await screen.findByText("Add your email to receive your score when it's published.")).toBeInTheDocument();
  });

  it("doesn't ask for an email reason when the quiz reveals on submit", async () => {
    vi.mocked(guestApi.getGuestQuizLanding).mockResolvedValue({ ...landing, revealOnSubmit: true });
    renderAt();
    expect(await screen.findByLabelText("Email (optional)")).toBeInTheDocument();
    expect(screen.queryByText(/receive your score/)).not.toBeInTheDocument();
  });

  it("starts with the name and email, keeps the session and opens the quiz", async () => {
    vi.mocked(guestApi.startGuestQuiz).mockResolvedValue({ sessionToken: "session-1", attempt });
    const user = userEvent.setup();
    renderAt();

    await user.type(await screen.findByLabelText("Full name"), "Grace Hopper");
    await user.type(screen.getByLabelText("Email (optional)"), "grace@example.com");
    await user.click(screen.getByRole("button", { name: "Start quiz" }));

    expect(await screen.findByText("2 + 2 = ?")).toBeInTheDocument();
    expect(guestApi.startGuestQuiz).toHaveBeenCalledWith("link-1", {
      fullName: "Grace Hopper",
      email: "grace@example.com",
      captchaToken: null,
      website: "",
    });
    expect(localStorage.getItem(SESSION_KEY)).toBe("session-1");
  });

  it("sends no email when the field is blank", async () => {
    vi.mocked(guestApi.startGuestQuiz).mockResolvedValue({ sessionToken: "session-1", attempt });
    const user = userEvent.setup();
    renderAt();

    await user.type(await screen.findByLabelText("Full name"), "Bola");
    await user.click(screen.getByRole("button", { name: "Start quiz" }));

    await screen.findByText("2 + 2 = ?");
    expect(vi.mocked(guestApi.startGuestQuiz).mock.calls[0][1].email).toBeNull();
  });

  it("shows why a repeated email was refused and stays on the form", async () => {
    vi.mocked(guestApi.startGuestQuiz).mockRejectedValue(
      new ApiError(422, "This email address has already been used for this quiz."),
    );
    const user = userEvent.setup();
    renderAt();

    await user.type(await screen.findByLabelText("Full name"), "Grace");
    await user.type(screen.getByLabelText("Email (optional)"), "grace@example.com");
    await user.click(screen.getByRole("button", { name: "Start quiz" }));

    expect(await screen.findByText("This email address has already been used for this quiz.")).toBeInTheDocument();
    expect(screen.getByLabelText("Full name")).toBeInTheDocument();
    expect(localStorage.getItem(SESSION_KEY)).toBeNull();
  });

  it("doesn't offer the form once the quiz has closed", async () => {
    vi.mocked(guestApi.getGuestQuizLanding).mockResolvedValue({ ...landing, availability: "CLOSED" });
    renderAt();
    expect(await screen.findByText("This quiz has closed.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Start quiz" })).not.toBeInTheDocument();
  });

  it("resumes an attempt in progress on this device", async () => {
    localStorage.setItem(SESSION_KEY, "session-1");
    vi.mocked(guestApi.getGuestQuizSession).mockResolvedValue(session);
    vi.mocked(guestApi.resumeGuestQuiz).mockResolvedValue(attempt);
    renderAt();

    expect(await screen.findByText("2 + 2 = ?")).toBeInTheDocument();
    expect(guestApi.resumeGuestQuiz).toHaveBeenCalledWith("session-1");
    expect(guestApi.getGuestQuizLanding).not.toHaveBeenCalled();
  });

  it("promises an email only to a guest who gave one while the score is hidden", async () => {
    localStorage.setItem(SESSION_KEY, "session-1");
    vi.mocked(guestApi.getGuestQuizSession).mockResolvedValue({ ...session, attemptState: "SUBMITTED" });
    renderAt();

    expect(await screen.findByText(/Your score will be emailed to you/)).toBeInTheDocument();
  });

  it("tells a guest with no email to come back to this device", async () => {
    localStorage.setItem(SESSION_KEY, "session-1");
    vi.mocked(guestApi.getGuestQuizSession).mockResolvedValue({
      ...session,
      attemptState: "SUBMITTED",
      hasEmail: false,
    });
    renderAt();

    expect(await screen.findByText(/Reopen this link on this device/)).toBeInTheDocument();
  });

  it("shows the result once it's released, even to a guest with no email", async () => {
    localStorage.setItem(SESSION_KEY, "session-1");
    vi.mocked(guestApi.getGuestQuizSession).mockResolvedValue({
      ...session,
      attemptState: "SUBMITTED",
      hasEmail: false,
      revealResults: true,
    });
    vi.mocked(guestApi.getGuestQuizReview).mockResolvedValue({
      score: 2,
      totalPoints: 2,
      questions: [],
    } as QuizReviewView);
    renderAt();

    await waitFor(() => expect(guestApi.getGuestQuizReview).toHaveBeenCalledWith("session-1"));
  });

  it("falls back to the form when the stored session is gone", async () => {
    localStorage.setItem(SESSION_KEY, "stale");
    vi.mocked(guestApi.getGuestQuizSession).mockRejectedValue(notFound());
    renderAt();

    expect(await screen.findByLabelText("Full name")).toBeInTheDocument();
    expect(localStorage.getItem(SESSION_KEY)).toBeNull();
  });
});

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as takeHomeQuizzesApi from "@/api/takeHomeQuizzes";
import { PublishQuizModal } from "@/features/takeHomeQuizzes/components/PublishQuizModal";

vi.mock("@/api/takeHomeQuizzes", async () => {
  const actual = await vi.importActual<typeof import("@/api/takeHomeQuizzes")>("@/api/takeHomeQuizzes");
  return {
    ...actual,
    publishTakeHomeQuiz: vi.fn(),
  };
});

beforeEach(() => vi.clearAllMocks());

describe("PublishQuizModal", () => {
  it("shows the roster size and close time before publishing", () => {
    render(
      <PublishQuizModal
        open
        onClose={vi.fn()}
        quizId="quiz-1"
        rosterSize={30}
        portalRosterSize={0}
        closesAt="2026-03-08T00:00:00Z"
        onPublished={vi.fn()}
      />,
    );

    expect(screen.getByText("30", { exact: false })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Publish" })).toBeInTheDocument();
  });

  it("publishes and shows the outcome, including a failed row", async () => {
    const onPublished = vi.fn();
    vi.mocked(takeHomeQuizzesApi.publishTakeHomeQuiz).mockResolvedValue({
      tokensMinted: 2,
      guardiansNotified: 1,
      perStudent: [
        { studentId: "student-2", studentName: "Bola Ade", success: false, message: "No active guardian contact - copy this student's link manually." },
      ],
    });
    render(
      <PublishQuizModal
        open
        onClose={vi.fn()}
        quizId="quiz-1"
        rosterSize={2}
        portalRosterSize={0}
        closesAt="2026-03-08T00:00:00Z"
        onPublished={onPublished}
      />,
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Publish" }));

    expect(await screen.findByText("2", { exact: false })).toBeInTheDocument();
    expect(screen.getByText("Bola Ade")).toBeInTheDocument();
    expect(screen.getByText(/No active guardian contact/)).toBeInTheDocument();
    expect(takeHomeQuizzesApi.publishTakeHomeQuiz).toHaveBeenCalledWith("quiz-1");
    expect(onPublished).toHaveBeenCalled();
  });

  it("says nobody gets a link when every pupil has a portal login", async () => {
    vi.mocked(takeHomeQuizzesApi.publishTakeHomeQuiz).mockResolvedValue({
      tokensMinted: 0,
      guardiansNotified: 0,
      perStudent: [],
    });
    render(
      <PublishQuizModal
        open
        onClose={vi.fn()}
        quizId="quiz-1"
        rosterSize={4}
        portalRosterSize={4}
        closesAt="2026-03-08T00:00:00Z"
        onPublished={vi.fn()}
      />,
    );

    expect(screen.getByText(/have portal logins/)).toBeInTheDocument();
    expect(screen.getByText(/No links will be created and no guardian emails sent/)).toBeInTheDocument();
    expect(screen.queryByText(/mint a link/)).not.toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole("button", { name: "Publish" }));

    expect(await screen.findByText("Published. Pupils will find it in their portal.")).toBeInTheDocument();
  });

  it("splits the roster when only some pupils have portal logins", () => {
    render(
      <PublishQuizModal
        open
        onClose={vi.fn()}
        quizId="quiz-1"
        rosterSize={5}
        portalRosterSize={2}
        closesAt="2026-03-08T00:00:00Z"
        onPublished={vi.fn()}
      />,
    );

    expect(screen.getByText(/with a portal login will find this quiz in their portal/)).toBeInTheDocument();
    expect(screen.getByText(/A link will be created for each of the other/)).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });
});

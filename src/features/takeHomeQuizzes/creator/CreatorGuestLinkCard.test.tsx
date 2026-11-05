import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as classQuizzesApi from "@/api/classTakeHomeQuizzes";
import { CreatorGuestLinkCard } from "./CreatorGuestLinkCard";

vi.mock("@/api/classTakeHomeQuizzes");

const URL = "https://app.example/take-home-quiz/guest?link=abc";

function renderCard(overrides: Partial<Parameters<typeof CreatorGuestLinkCard>[0]> = {}) {
  render(
    <CreatorGuestLinkCard
      classId="class-1"
      quizId="quiz-1"
      readOnly={false}
      draft={false}
      revealResultsOnSubmit={false}
      {...overrides}
    />,
  );
}

describe("CreatorGuestLinkCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a link and shows it", async () => {
    vi.mocked(classQuizzesApi.getClassQuizGuestLink).mockResolvedValue({ active: false });
    vi.mocked(classQuizzesApi.createClassQuizGuestLink).mockResolvedValue({ active: true, url: URL });
    const user = userEvent.setup();
    renderCard();

    await user.click(await screen.findByRole("button", { name: "Create guest link" }));

    expect(await screen.findByLabelText("Guest link")).toHaveValue(URL);
    expect(classQuizzesApi.createClassQuizGuestLink).toHaveBeenCalledWith("class-1", "quiz-1");
  });

  it("says a score email goes out only when the quiz hides scores", async () => {
    vi.mocked(classQuizzesApi.getClassQuizGuestLink).mockResolvedValue({ active: false });
    renderCard();
    expect(await screen.findByText(/sent their score when you publish results/)).toBeInTheDocument();
  });

  it("says a draft's link isn't open yet", async () => {
    vi.mocked(classQuizzesApi.getClassQuizGuestLink).mockResolvedValue({ active: true, url: URL });
    renderCard({ draft: true });
    expect(await screen.findByText("This link opens once the quiz is published.")).toBeInTheDocument();
  });

  it("revokes after confirming", async () => {
    vi.mocked(classQuizzesApi.getClassQuizGuestLink).mockResolvedValue({ active: true, url: URL });
    vi.mocked(classQuizzesApi.revokeClassQuizGuestLink).mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderCard();

    await user.click(await screen.findByRole("button", { name: "Revoke link" }));
    const buttons = await screen.findAllByRole("button", { name: "Revoke link" });
    await user.click(buttons[buttons.length - 1]);

    expect(await screen.findByRole("button", { name: "Create guest link" })).toBeInTheDocument();
    expect(classQuizzesApi.revokeClassQuizGuestLink).toHaveBeenCalledWith("class-1", "quiz-1");
  });

  it("offers a replacement when a live link can't be shown again", async () => {
    vi.mocked(classQuizzesApi.getClassQuizGuestLink).mockResolvedValue({ active: true });
    renderCard();
    expect(await screen.findByRole("button", { name: "Create new link" })).toBeInTheDocument();
  });

  it("offers no changes on a read-only class", async () => {
    vi.mocked(classQuizzesApi.getClassQuizGuestLink).mockResolvedValue({ active: true, url: URL });
    renderCard({ readOnly: true });
    expect(await screen.findByLabelText("Guest link")).toHaveValue(URL);
    expect(screen.queryByRole("button", { name: "Revoke link" })).not.toBeInTheDocument();
  });
});

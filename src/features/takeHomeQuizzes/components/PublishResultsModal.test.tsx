import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as takeHomeQuizzesApi from "@/api/takeHomeQuizzes";
import { PublishResultsModal } from "@/features/takeHomeQuizzes/components/PublishResultsModal";

vi.mock("@/api/takeHomeQuizzes", async () => {
  const actual = await vi.importActual<typeof import("@/api/takeHomeQuizzes")>("@/api/takeHomeQuizzes");
  return {
    ...actual,
    getPublishResultsPreflight: vi.fn(),
    publishTakeHomeQuizResults: vi.fn(),
  };
});

beforeEach(() => vi.clearAllMocks());

describe("PublishResultsModal", () => {
  it("renders blockers and disables the confirm button", async () => {
    vi.mocked(takeHomeQuizzesApi.getPublishResultsPreflight).mockResolvedValue({
      canPublish: false,
      blockers: ["The quiz is still open and 2 student(s) have not yet submitted."],
      nonSubmitters: [],
      submittedCount: 1,
      rosterSize: 3,
      willWriteBack: false,
      midtermMax: null,
    });

    render(
      <PublishResultsModal quizId="quiz-1" quizType="MIDTERM" onClose={vi.fn()} onPublished={vi.fn()} />,
    );

    expect(await screen.findByText(/have not yet submitted/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Publish results" })).toBeDisabled();
  });

  it("lists non-submitters by name and gates the confirm button on the checkbox", async () => {
    vi.mocked(takeHomeQuizzesApi.getPublishResultsPreflight).mockResolvedValue({
      canPublish: true,
      blockers: [],
      nonSubmitters: [{ studentId: "student-2", fullName: "Bola Ade" }],
      submittedCount: 2,
      rosterSize: 3,
      willWriteBack: true,
      midtermMax: 20,
    });

    render(
      <PublishResultsModal quizId="quiz-1" quizType="MIDTERM" onClose={vi.fn()} onPublished={vi.fn()} />,
    );

    expect(await screen.findByText("Bola Ade")).toBeInTheDocument();
    const confirmButton = screen.getByRole("button", { name: "Publish results" });
    expect(confirmButton).toBeDisabled();

    const user = userEvent.setup();
    await user.click(screen.getByRole("checkbox"));
    expect(confirmButton).toBeEnabled();
  });

  it("publishes and shows the write-back outcome, including a failed row", async () => {
    vi.mocked(takeHomeQuizzesApi.getPublishResultsPreflight).mockResolvedValue({
      canPublish: true,
      blockers: [],
      nonSubmitters: [{ studentId: "student-2", fullName: "Bola Ade" }],
      submittedCount: 2,
      rosterSize: 3,
      willWriteBack: true,
      midtermMax: 20,
    });
    vi.mocked(takeHomeQuizzesApi.publishTakeHomeQuizResults).mockResolvedValue({
      published: true,
      scoresWritten: 2,
      perStudent: [
        { studentId: "student-3", studentName: "Chidi Eze", success: false, message: "No enrollment for this term." },
      ],
    });
    const onPublished = vi.fn();

    render(
      <PublishResultsModal quizId="quiz-1" quizType="MIDTERM" onClose={vi.fn()} onPublished={onPublished} />,
    );

    await screen.findByText("Bola Ade");
    const user = userEvent.setup();
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Publish results" }));

    await waitFor(() =>
      expect(takeHomeQuizzesApi.publishTakeHomeQuizResults).toHaveBeenCalledWith("quiz-1", true),
    );
    expect(await screen.findByText("Chidi Eze")).toBeInTheDocument();
    expect(screen.getByText(/No enrollment for this term/)).toBeInTheDocument();
    expect(screen.getByText("2", { exact: false })).toBeInTheDocument();
    expect(onPublished).toHaveBeenCalled();
  });

  it("says nothing is written to the gradebook for a normal quiz", async () => {
    vi.mocked(takeHomeQuizzesApi.getPublishResultsPreflight).mockResolvedValue({
      canPublish: true,
      blockers: [],
      nonSubmitters: [],
      submittedCount: 3,
      rosterSize: 3,
      willWriteBack: false,
      midtermMax: null,
    });
    vi.mocked(takeHomeQuizzesApi.publishTakeHomeQuizResults).mockResolvedValue({
      published: true,
      scoresWritten: 0,
      perStudent: [],
    });

    render(<PublishResultsModal quizId="quiz-1" quizType="NORMAL" onClose={vi.fn()} onPublished={vi.fn()} />);

    const confirmButton = await screen.findByRole("button", { name: "Publish results" });
    expect(confirmButton).toBeEnabled();
    const user = userEvent.setup();
    await user.click(confirmButton);

    expect(await screen.findByText(/Nothing is written to the gradebook for a normal quiz/)).toBeInTheDocument();
  });
});

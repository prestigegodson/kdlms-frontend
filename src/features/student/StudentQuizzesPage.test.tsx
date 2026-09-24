import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as myTakeHomeQuizzesApi from "@/api/myTakeHomeQuizzes";
import { StudentQuizzesPage } from "@/features/student/StudentQuizzesPage";

vi.mock("@/api/myTakeHomeQuizzes", async () => {
  const actual = await vi.importActual<typeof import("@/api/myTakeHomeQuizzes")>("@/api/myTakeHomeQuizzes");
  return { ...actual, listMyTakeHomeQuizzes: vi.fn() };
});

const QUIZ_REVEALED_BEFORE_PUBLISH: myTakeHomeQuizzesApi.MyTakeHomeQuizSummaryView = {
  id: "quiz-1",
  title: "Fractions quiz",
  subjectName: "Mathematics",
  quizType: "NORMAL",
  availability: "OPEN",
  attemptState: "SUBMITTED",
  resultsPublished: false,
  score: 4,
  totalPoints: 5,
  closesAt: "2026-10-01T00:00:00Z",
};

const QUIZ_AWAITING_RESULTS: myTakeHomeQuizzesApi.MyTakeHomeQuizSummaryView = {
  id: "quiz-2",
  title: "Grammar quiz",
  subjectName: "English",
  quizType: "NORMAL",
  availability: "OPEN",
  attemptState: "SUBMITTED",
  resultsPublished: false,
  score: null,
  totalPoints: 10,
  closesAt: "2026-10-02T00:00:00Z",
};

function pageOf(
  content: myTakeHomeQuizzesApi.MyTakeHomeQuizSummaryView[],
  number = 0,
  totalElements = content.length,
  size = 20,
) {
  return { content, number, size, totalElements, totalPages: Math.ceil(totalElements / size) };
}

function renderPage() {
  const router = createMemoryRouter([{ path: "/", element: <StudentQuizzesPage /> }], {
    initialEntries: ["/"],
  });
  render(<RouterProvider router={router} />);
}

beforeEach(() => vi.clearAllMocks());

describe("StudentQuizzesPage", () => {
  it("shows the score once the attempt is reviewable, even before results are published", async () => {
    vi.mocked(myTakeHomeQuizzesApi.listMyTakeHomeQuizzes).mockResolvedValue(pageOf([QUIZ_REVEALED_BEFORE_PUBLISH]));

    renderPage();

    await screen.findByText("Fractions quiz");
    const row = screen.getByText("Fractions quiz").closest("a");
    expect(row?.textContent).toContain("4/5");
  });

  it("renders a submitted attempt with no score yet as a disabled, non-clickable row", async () => {
    vi.mocked(myTakeHomeQuizzesApi.listMyTakeHomeQuizzes).mockResolvedValue(pageOf([QUIZ_AWAITING_RESULTS]));

    renderPage();

    await screen.findByText("Grammar quiz");
    expect(screen.getByText("Grammar quiz").closest("a")).toBeNull();
    expect(screen.getByText("Submitted · awaiting results")).toBeInTheDocument();
  });

  it("requests the next page when paging forward", async () => {
    vi.mocked(myTakeHomeQuizzesApi.listMyTakeHomeQuizzes).mockImplementation((page = 0) =>
      Promise.resolve(
        page === 0
          ? pageOf([QUIZ_REVEALED_BEFORE_PUBLISH], 0, 21)
          : pageOf([QUIZ_AWAITING_RESULTS], 1, 21),
      ),
    );

    renderPage();

    await screen.findByText("Fractions quiz");
    expect(myTakeHomeQuizzesApi.listMyTakeHomeQuizzes).toHaveBeenCalledWith(0, 20);

    fireEvent.click(screen.getByRole("button", { name: "Next page" }));

    await screen.findByText("Grammar quiz");
    await waitFor(() => expect(myTakeHomeQuizzesApi.listMyTakeHomeQuizzes).toHaveBeenCalledWith(1, 20));
  });

  it("shows a this-term empty state when there are no quizzes", async () => {
    vi.mocked(myTakeHomeQuizzesApi.listMyTakeHomeQuizzes).mockResolvedValue(pageOf([]));

    renderPage();

    expect(await screen.findByText("No quizzes this term")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Next page" })).toBeNull();
  });
});

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as myTakeHomeQuizzesApi from "@/api/myTakeHomeQuizzes";
import { StudentQuizzesPage } from "@/features/student/StudentQuizzesPage";

vi.mock("@/api/myTakeHomeQuizzes", async () => {
  const actual = await vi.importActual<typeof import("@/api/myTakeHomeQuizzes")>("@/api/myTakeHomeQuizzes");
  return { ...actual, listMyTakeHomeQuizzes: vi.fn() };
});

type Summary = myTakeHomeQuizzesApi.MyTakeHomeQuizSummaryView;

const BASE: Summary = {
  id: "quiz-0",
  title: "Base quiz",
  subjectName: "Mathematics",
  quizType: "NORMAL",
  availability: "OPEN",
  attemptState: "NOT_STARTED",
  resultsPublished: false,
  score: null,
  totalPoints: 10,
  closesAt: "2026-10-01T00:00:00Z",
  opensAt: "2026-09-20T00:00:00Z",
  questionCount: 1,
  timed: false,
};

const QUIZ_REVEALED_BEFORE_PUBLISH: Summary = {
  ...BASE,
  id: "quiz-1",
  title: "Fractions quiz",
  attemptState: "SUBMITTED",
  score: 4,
  totalPoints: 5,
};

const QUIZ_AWAITING_RESULTS: Summary = {
  ...BASE,
  id: "quiz-2",
  title: "Grammar quiz",
  subjectName: "English",
  attemptState: "SUBMITTED",
};

const TIMED_MIDTERM: Summary = {
  ...BASE,
  id: "quiz-3",
  title: "Midterm algebra",
  quizType: "MIDTERM",
  questionCount: 12,
  totalPoints: 30,
  timed: true,
  durationMinutes: 45,
};

function pageOf(content: Summary[], number = 0, totalElements = content.length, size = 20) {
  return { content, number, size, totalElements, totalPages: Math.ceil(totalElements / size) };
}

function renderPage(initialEntry = "/") {
  const router = createMemoryRouter([{ path: "/", element: <StudentQuizzesPage /> }], {
    initialEntries: [initialEntry],
  });
  render(<RouterProvider router={router} />);
  return router;
}

const list = () => vi.mocked(myTakeHomeQuizzesApi.listMyTakeHomeQuizzes);

beforeEach(() => vi.clearAllMocks());

describe("StudentQuizzesPage", () => {
  it("opens on the To do tab and asks the server for that tab only", async () => {
    list().mockResolvedValue(pageOf([TIMED_MIDTERM]));

    renderPage();

    await screen.findByText("Midterm algebra");
    expect(list()).toHaveBeenCalledTimes(1);
    expect(list()).toHaveBeenCalledWith(0, 20, "TODO");
    expect(screen.getByRole("tab", { name: "To do" })).toHaveAttribute("aria-selected", "true");
  });

  it("shows question count, total score, duration and quiz type on the card", async () => {
    list().mockResolvedValue(pageOf([TIMED_MIDTERM, { ...BASE, id: "quiz-4", title: "Spelling", questionCount: 1 }]));

    renderPage();

    const card = (await screen.findByText("Midterm algebra")).closest("a") as HTMLElement;
    expect(card).toHaveAttribute("href", "/student/quizzes/quiz-3");
    expect(within(card).getByText("12 questions")).toBeInTheDocument();
    expect(within(card).getByText("Total score: 30")).toBeInTheDocument();
    expect(within(card).getByText("Timed · 45 min")).toBeInTheDocument();
    expect(within(card).getByText("Midterm")).toBeInTheDocument();

    const untimed = screen.getByText("Spelling").closest("a") as HTMLElement;
    expect(within(untimed).getByText("1 question")).toBeInTheDocument();
    expect(within(untimed).getByText("Untimed")).toBeInTheDocument();
    expect(within(untimed).getByText("Normal")).toBeInTheDocument();
  });

  it("calls each tab's own filter and resets to the first page when switching", async () => {
    list().mockImplementation((page = 0) =>
      Promise.resolve(page === 0 ? pageOf([TIMED_MIDTERM], 0, 21) : pageOf([BASE], 1, 21)),
    );

    renderPage();
    await screen.findByText("Midterm algebra");

    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    await waitFor(() => expect(list()).toHaveBeenCalledWith(1, 20, "TODO"));

    for (const [label, filter] of [
      ["Upcoming", "UPCOMING"],
      ["Completed", "COMPLETED"],
      ["Missed", "MISSED"],
    ] as const) {
      fireEvent.click(screen.getByRole("tab", { name: label }));
      await waitFor(() => expect(list()).toHaveBeenLastCalledWith(0, 20, filter));
    }
  });

  it("restores the tab from the URL", async () => {
    list().mockResolvedValue(pageOf([QUIZ_REVEALED_BEFORE_PUBLISH]));

    renderPage("/?tab=completed");

    await screen.findByText("Fractions quiz");
    expect(list()).toHaveBeenCalledWith(0, 20, "COMPLETED");
    expect(screen.getByRole("tab", { name: "Completed" })).toHaveAttribute("aria-selected", "true");
  });

  it("shows the score once the attempt is reviewable, even before results are published", async () => {
    list().mockResolvedValue(pageOf([QUIZ_REVEALED_BEFORE_PUBLISH]));

    renderPage("/?tab=completed");

    const card = (await screen.findByText("Fractions quiz")).closest("a");
    expect(card?.textContent).toContain("4/5");
  });

  it("renders a submitted attempt with no score yet as an inert card", async () => {
    list().mockResolvedValue(pageOf([QUIZ_AWAITING_RESULTS]));

    renderPage("/?tab=completed");

    await screen.findByText("Grammar quiz");
    expect(screen.getByText("Grammar quiz").closest("a")).toBeNull();
    expect(screen.getByText("Awaiting results")).toBeInTheDocument();
    expect(screen.getByText("Results will appear once your teacher releases them")).toBeInTheDocument();
  });

  it("shows the tab's own empty state", async () => {
    list().mockResolvedValue(pageOf([]));

    renderPage("/?tab=missed");

    expect(await screen.findByText("No missed quizzes")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Next page" })).toBeNull();
  });

  it("keeps the tabs visible and retries when the load fails", async () => {
    list().mockRejectedValueOnce(new Error("boom")).mockResolvedValue(pageOf([TIMED_MIDTERM]));

    renderPage();

    expect(await screen.findByText("Failed to load your quizzes")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "To do" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /retry|try again/i }));
    expect(await screen.findByText("Midterm algebra")).toBeInTheDocument();
  });
});

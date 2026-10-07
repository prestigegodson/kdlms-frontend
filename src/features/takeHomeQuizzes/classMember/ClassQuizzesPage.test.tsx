import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as classQuizzesApi from "@/api/classTakeHomeQuizzes";
import { ApiError } from "@/api/client";
import type { MyTakeHomeQuizSummaryView } from "@/api/myTakeHomeQuizzes";
import * as onlineClassesApi from "@/api/onlineClasses";
import type { OnlineClass } from "@/api/onlineClasses";
import { ClassQuizzesPage } from "./ClassQuizzesPage";

vi.mock("@/api/classTakeHomeQuizzes", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/api/classTakeHomeQuizzes")>()),
  listMemberClassQuizzes: vi.fn(),
  getMemberClassQuizReview: vi.fn(),
  downloadClassQuizImage: vi.fn(),
}));
vi.mock("@/api/onlineClasses");

const MATHS: OnlineClass = {
  id: "c1",
  name: "Maths",
  description: null,
  subjectLabel: null,
  creatorName: "Ada's Studio",
  timezone: "Africa/Lagos",
  startDate: "2026-10-01",
  endDate: null,
  slots: [],
  upcoming: [],
  remindersEnabled: true,
};

function quiz(overrides: Partial<MyTakeHomeQuizSummaryView>): MyTakeHomeQuizSummaryView {
  return {
    id: "q1",
    title: "Fractions check",
    subjectName: "",
    quizType: "NORMAL",
    availability: "OPEN",
    attemptState: "NOT_STARTED",
    resultsPublished: false,
    score: null,
    totalPoints: 4,
    closesAt: "2026-10-11T09:00:00Z",
    ...overrides,
  };
}

function renderAt(path: string, audience: "LEARNER" | "GUARDIAN") {
  const router = createMemoryRouter([{ path: "/quizzes", element: <ClassQuizzesPage audience={audience} /> }], {
    initialEntries: [path],
  });
  render(<RouterProvider router={router} />);
}

describe("ClassQuizzesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(onlineClassesApi.listMyOnlineClasses).mockResolvedValue([MATHS]);
    vi.mocked(onlineClassesApi.listWardOnlineClasses).mockResolvedValue([
      { learnerId: "l1", firstName: "Kemi", lastName: "Ola", classes: [MATHS] },
    ]);
  });

  it("lists a learner's open quizzes as links into the quiz", async () => {
    vi.mocked(classQuizzesApi.listMemberClassQuizzes).mockResolvedValue({
      classId: "c1",
      className: "Maths",
      quizzes: [quiz({})],
    });
    renderAt("/quizzes", "LEARNER");

    const link = await screen.findByRole("link", { name: /Fractions check/ });
    expect(link).toHaveAttribute("href", "/learner/quizzes/c1/q1");
    expect(screen.getByText("Open")).toBeInTheDocument();
    expect(classQuizzesApi.listMemberClassQuizzes).toHaveBeenCalledWith({ classId: "c1", learnerId: undefined });
  });

  it("shows a guardian their child's released score and answers", async () => {
    vi.mocked(classQuizzesApi.listMemberClassQuizzes).mockResolvedValue({
      classId: "c1",
      className: "Maths",
      quizzes: [quiz({ attemptState: "SUBMITTED", resultsPublished: true, score: 3, availability: "CLOSED" })],
    });
    vi.mocked(classQuizzesApi.getMemberClassQuizReview).mockResolvedValue({
      score: 3,
      totalPoints: 4,
      questions: [],
    });
    renderAt("/quizzes", "GUARDIAN");
    const user = userEvent.setup();

    await waitFor(() =>
      expect(classQuizzesApi.listMemberClassQuizzes).toHaveBeenCalledWith({ classId: "c1", learnerId: "l1" }),
    );
    await user.click(await screen.findByRole("button", { name: /Fractions check/ }));

    await waitFor(() =>
      expect(classQuizzesApi.getMemberClassQuizReview).toHaveBeenCalledWith({ classId: "c1", learnerId: "l1" }, "q1"),
    );
    expect(screen.queryByRole("link", { name: /Fractions check/ })).not.toBeInTheDocument();
  });

  it("explains when the tutor's plan doesn't include quizzes", async () => {
    vi.mocked(classQuizzesApi.listMemberClassQuizzes).mockRejectedValue(
      new ApiError(403, "CBT/Quizzes are not included in the current plan."),
    );
    renderAt("/quizzes", "LEARNER");

    expect(await screen.findByText("CBT/Quizzes are not included in the current plan.")).toBeInTheDocument();
  });
});

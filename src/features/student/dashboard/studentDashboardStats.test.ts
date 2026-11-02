import { describe, expect, it } from "vitest";
import type { MyLearningResourceSummaryView } from "@/api/learning";
import type { MyTakeHomeQuizSummaryView } from "@/api/myTakeHomeQuizzes";
import {
  dueSoonQuizzes,
  quizProgress,
  quizStatus,
  scorePercent,
  scoreTrend,
  subjectProgress,
} from "@/features/student/dashboard/studentDashboardStats";

const NOW = new Date("2026-11-02T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

function quiz(overrides: Partial<MyTakeHomeQuizSummaryView> = {}): MyTakeHomeQuizSummaryView {
  return {
    id: "q1",
    title: "Quiz",
    subjectName: "Maths",
    quizType: "PRACTICE" as MyTakeHomeQuizSummaryView["quizType"],
    availability: "OPEN",
    attemptState: "NOT_STARTED",
    resultsPublished: false,
    score: null,
    totalPoints: 20,
    closesAt: new Date(NOW.getTime() + DAY).toISOString(),
    opensAt: new Date(NOW.getTime() - DAY).toISOString(),
    questionCount: 5,
    timed: false,
    ...overrides,
  };
}

function resource(overrides: Partial<MyLearningResourceSummaryView> = {}): MyLearningResourceSummaryView {
  return {
    id: "r1",
    title: "Lesson",
    description: null,
    subjectName: "Maths",
    resourceType: "VIDEO" as MyLearningResourceSummaryView["resourceType"],
    durationSeconds: 600,
    position: 0,
    completed: false,
    availableUntil: null,
    ...overrides,
  };
}

describe("dueSoonQuizzes", () => {
  it("counts open, unsubmitted quizzes closing within seven days, inclusive", () => {
    const quizzes = [
      quiz({ id: "a" }),
      quiz({ id: "edge", closesAt: new Date(NOW.getTime() + 7 * DAY).toISOString() }),
      quiz({ id: "far", closesAt: new Date(NOW.getTime() + 7 * DAY + 1000).toISOString() }),
      quiz({ id: "past", closesAt: new Date(NOW.getTime() - 1000).toISOString() }),
      quiz({ id: "done", attemptState: "SUBMITTED" }),
      quiz({ id: "later", availability: "SCHEDULED" }),
    ];
    expect(dueSoonQuizzes(quizzes, NOW).map((q) => q.id)).toEqual(["a", "edge"]);
  });
});

describe("scores", () => {
  it("rounds released scores and leaves unreleased ones null", () => {
    expect(scorePercent(quiz({ score: 13, totalPoints: 20 }))).toBe(65);
    expect(scorePercent(quiz({ score: 1, totalPoints: 3 }))).toBe(33);
    expect(scorePercent(quiz({ score: null }))).toBeNull();
    // The API omits a null score from the JSON, so it arrives undefined.
    expect(scorePercent(quiz({ score: undefined as unknown as null }))).toBeNull();
    expect(scorePercent(quiz({ score: 0, totalPoints: 0 }))).toBeNull();
  });

  it("orders the trend by due date and skips unreleased scores", () => {
    const trend = scoreTrend([
      quiz({ score: 18, closesAt: "2026-10-20T00:00:00Z" }),
      quiz({ score: 10, closesAt: "2026-10-01T00:00:00Z" }),
      quiz({ score: null, closesAt: "2026-10-10T00:00:00Z" }),
    ]);
    expect(trend).toEqual([50, 90]);
  });

  it("tallies completion and mastery at the 70% threshold", () => {
    expect(
      quizProgress([
        quiz({ attemptState: "SUBMITTED", score: 14 }),
        quiz({ attemptState: "SUBMITTED", score: 13 }),
        quiz({ attemptState: "SUBMITTED" }),
        quiz({ availability: "SCHEDULED" }),
      ]),
    ).toEqual({ available: 3, submitted: 3, released: 2, mastered: 1 });
  });

  it("is all zeros for no quizzes", () => {
    expect(quizProgress([])).toEqual({ available: 0, submitted: 0, released: 0, mastered: 0 });
  });
});

describe("quizStatus", () => {
  it("maps attempt state and availability to one status", () => {
    expect(quizStatus(quiz({ attemptState: "SUBMITTED", availability: "CLOSED" }))).toBe("completed");
    expect(quizStatus(quiz({ availability: "CLOSED" }))).toBe("missed");
    expect(quizStatus(quiz({ availability: "SCHEDULED" }))).toBe("upcoming");
    expect(quizStatus(quiz({ attemptState: "IN_PROGRESS" }))).toBe("inProgress");
    expect(quizStatus(quiz())).toBe("available");
  });
});

describe("resources", () => {
  it("groups completion by subject, highest first", () => {
    expect(
      subjectProgress([
        resource({ subjectName: "Maths", completed: true }),
        resource({ subjectName: "Maths" }),
        resource({ subjectName: "English", completed: true }),
      ]),
    ).toEqual([
      { subjectName: "English", completed: 1, total: 1, percent: 100 },
      { subjectName: "Maths", completed: 1, total: 2, percent: 50 },
    ]);
    expect(subjectProgress([])).toEqual([]);
  });
});

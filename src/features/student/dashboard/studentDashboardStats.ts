import type { MyLearningResourceSummaryView } from "@/api/learning";
import type { MyTakeHomeQuizSummaryView } from "@/api/myTakeHomeQuizzes";

/**
 * Pure derivations behind the student Home dashboard - every number on the page comes from the
 * student's own quiz list and resource list, never from term results (students don't see those).
 */

export const DUE_SOON_DAYS = 7;
/** A released quiz score at or above this percentage counts as "mastered". */
export const MASTERY_THRESHOLD_PERCENT = 70;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Open, not yet submitted, and closing within `DUE_SOON_DAYS` from `now`. */
export function dueSoonQuizzes(quizzes: MyTakeHomeQuizSummaryView[], now: Date = new Date()): MyTakeHomeQuizSummaryView[] {
  const horizon = now.getTime() + DUE_SOON_DAYS * DAY_MS;
  return quizzes.filter((quiz) => {
    if (quiz.availability !== "OPEN" || quiz.attemptState === "SUBMITTED") {
      return false;
    }
    const closes = Date.parse(quiz.closesAt);
    return !Number.isNaN(closes) && closes >= now.getTime() && closes <= horizon;
  });
}

/**
 * Score as a whole-number percentage, or null while the score isn't reviewable yet. The server
 * omits a null `score` from the JSON entirely, so it arrives as `undefined` - check the type, not `=== null`.
 */
export function scorePercent(quiz: MyTakeHomeQuizSummaryView): number | null {
  if (typeof quiz.score !== "number" || quiz.totalPoints <= 0) {
    return null;
  }
  return clampPercent(Math.round((quiz.score / quiz.totalPoints) * 100));
}

export interface QuizProgress {
  /** Quizzes that have opened so far (not SCHEDULED). */
  available: number;
  submitted: number;
  released: number;
  mastered: number;
}

export function quizProgress(quizzes: MyTakeHomeQuizSummaryView[]): QuizProgress {
  let available = 0;
  let submitted = 0;
  let released = 0;
  let mastered = 0;
  for (const quiz of quizzes) {
    if (quiz.availability !== "SCHEDULED") {
      available += 1;
    }
    if (quiz.attemptState === "SUBMITTED") {
      submitted += 1;
    }
    const percent = scorePercent(quiz);
    if (percent !== null) {
      released += 1;
      if (percent >= MASTERY_THRESHOLD_PERCENT) {
        mastered += 1;
      }
    }
  }
  return { available, submitted, released, mastered };
}

/** Released score percentages, oldest due date first - the sparkline's points. */
export function scoreTrend(quizzes: MyTakeHomeQuizSummaryView[]): number[] {
  return quizzes
    .filter((quiz) => scorePercent(quiz) !== null)
    .slice()
    .sort((a, b) => Date.parse(a.closesAt) - Date.parse(b.closesAt))
    .map((quiz) => scorePercent(quiz) as number);
}

export interface SubjectProgress {
  subjectName: string;
  completed: number;
  total: number;
  percent: number;
}

/** Lesson completion per subject, highest completion first, then by name. */
export function subjectProgress(resources: MyLearningResourceSummaryView[]): SubjectProgress[] {
  const bySubject = new Map<string, { completed: number; total: number }>();
  for (const resource of resources) {
    const entry = bySubject.get(resource.subjectName) ?? { completed: 0, total: 0 };
    entry.total += 1;
    if (resource.completed) {
      entry.completed += 1;
    }
    bySubject.set(resource.subjectName, entry);
  }
  return Array.from(bySubject.entries())
    .map(([subjectName, { completed, total }]) => ({
      subjectName,
      completed,
      total,
      percent: percentOf(completed, total),
    }))
    .sort((a, b) => b.percent - a.percent || a.subjectName.localeCompare(b.subjectName));
}

export type QuizStatusKey = "completed" | "inProgress" | "available" | "upcoming" | "missed";

export const QUIZ_STATUS: Record<QuizStatusKey, { label: string; variant: "success" | "warning" | "brand" | "neutral" | "danger" }> = {
  completed: { label: "Completed", variant: "success" },
  inProgress: { label: "In progress", variant: "warning" },
  available: { label: "Available", variant: "brand" },
  upcoming: { label: "Upcoming", variant: "neutral" },
  missed: { label: "Missed", variant: "danger" },
};

export function quizStatus(quiz: MyTakeHomeQuizSummaryView): QuizStatusKey {
  if (quiz.attemptState === "SUBMITTED") {
    return "completed";
  }
  if (quiz.availability === "CLOSED") {
    return "missed";
  }
  if (quiz.availability === "SCHEDULED") {
    return "upcoming";
  }
  return quiz.attemptState === "IN_PROGRESS" ? "inProgress" : "available";
}

export function percentOf(part: number, total: number): number {
  return total > 0 ? clampPercent(Math.round((part / total) * 100)) : 0;
}

function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, value));
}

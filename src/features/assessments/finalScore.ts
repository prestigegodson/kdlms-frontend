import type { GradeBoundary } from "@/api/gradingSystems";

export interface FinalScoreResult {
  finalScore: number | null;
  grade: string | null;
  remark: string | null;
}

/**
 * Mirrors backend GradingSystem.computeFinalScore/gradeFor exactly, so the
 * entry grid can preview a score's final value and grade the moment a
 * teacher types it, before saving. Both components present -> each weighted
 * against its own max and summed; exactly one present -> that component
 * alone scaled to 100 (a quiz-support-less package, or a subject where only
 * the exam was entered, is graded on what exists); neither present -> null.
 */
export function computeFinalScore(
  quizScore: number | null,
  examScore: number | null,
  quizMax: number,
  examMax: number,
  quizWeight: number,
  examWeight: number,
  boundaries: GradeBoundary[],
): FinalScoreResult {
  const hasQuiz = quizScore !== null;
  const hasExam = examScore !== null;
  if (!hasQuiz && !hasExam) {
    return { finalScore: null, grade: null, remark: null };
  }

  let raw: number;
  if (hasQuiz && hasExam) {
    raw = (quizScore / quizMax) * quizWeight + (examScore / examMax) * examWeight;
  } else if (hasQuiz) {
    raw = (quizScore / quizMax) * 100;
  } else {
    raw = (examScore as number) / examMax * 100;
  }
  const finalScore = Math.round(raw * 100) / 100;

  const boundary = boundaries.find((candidate) => finalScore >= candidate.minScore && finalScore <= candidate.maxScore);
  return { finalScore, grade: boundary?.grade ?? null, remark: boundary?.remark ?? null };
}

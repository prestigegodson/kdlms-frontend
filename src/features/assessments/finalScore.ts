import type { GradeBoundary } from "@/api/gradingSystems";

export interface FinalScoreResult {
  finalScore: number | null;
  grade: string | null;
  remark: string | null;
}

/**
 * Mirrors backend GradingSystem.computeFinalScore/gradeFor exactly, so the
 * entry grid can preview a score's final value and grade the moment a
 * teacher types it, before saving. A quiz is a mid-term checkpoint, not a
 * term result, so it never grades on its own: both components present ->
 * each weighted against its own max and summed; exam present without a
 * quiz -> the exam alone scaled to 100 (graded on what exists); quiz
 * present without an exam, or neither present -> null.
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
  if (!hasExam) {
    return { finalScore: null, grade: null, remark: null };
  }

  let raw: number;
  if (hasQuiz) {
    raw = (quizScore / quizMax) * quizWeight + (examScore / examMax) * examWeight;
  } else {
    raw = (examScore as number) / examMax * 100;
  }
  const finalScore = Math.round(raw * 100) / 100;

  const boundary = boundaries.find((candidate) => finalScore >= candidate.minScore && finalScore <= candidate.maxScore);
  return { finalScore, grade: boundary?.grade ?? null, remark: boundary?.remark ?? null };
}

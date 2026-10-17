import type { AnswerCorrectionView } from "@/api/takeHomeQuizzes";

/** The success notice after a correction is saved. */
export function describeAnswerCorrection(result: AnswerCorrectionView<unknown>, nouns: { singular: string; plural: string }): string {
  if (result.changedQuestions === 0) return "Quiz saved. The answer key was unchanged.";
  const scores =
    result.scoresChanged === 0
      ? "no scores changed"
      : `the score changed for ${count(result.scoresChanged, nouns.singular, nouns.plural)}`;
  const gradebook = result.writeBack ? " The gradebook was updated." : "";
  return `Answer key corrected - ${count(result.submittedAttempts, "attempt")} re-scored, ${scores}.${gradebook}`;
}

export function count(n: number, singular: string, plural = `${singular}s`): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

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

export interface MidtermScoreResult {
  midtermScore: number | null;
  grade: string | null;
}

/**
 * Mirrors backend GradingSystem.computeMidtermScore exactly, so the entry
 * grid can preview the derived mid-term percentage as a teacher types the
 * quiz mark - a raw scale to 100, never weighted, unlike computeFinalScore.
 * Grade lookup is left to the caller (gate on the sheet's own
 * `showMidtermGrade` first).
 */
export function computeMidtermScore(
  quizScore: number | null,
  quizMax: number,
  boundaries: GradeBoundary[],
): MidtermScoreResult {
  if (quizScore === null || quizMax <= 0) {
    return { midtermScore: null, grade: null };
  }
  const midtermScore = Math.round((quizScore / quizMax) * 100 * 100) / 100;
  const boundary = boundaries.find((candidate) => midtermScore >= candidate.minScore && midtermScore <= candidate.maxScore);
  return { midtermScore, grade: boundary?.grade ?? null };
}

/**
 * The MIDTERM max a score table's header carries ("Score (20)"): the first
 * non-null `scoreMax` among its results - every row of a class normally shares
 * it. Undefined for a TERM result, which is already out of 100.
 */
export function commonScoreMax(results: ReadonlyArray<{ scoreMax?: number } | undefined>): number | undefined {
  return results.find((result) => result?.scoreMax != null)?.scoreMax;
}

/** A score column's header: `"Score (20)"` when a MIDTERM max applies, else the bare label. */
export function scoreHeader(label: string, headerMax: number | undefined): string {
  return headerMax == null ? label : `${label} (${headerMax})`;
}

/**
 * Renders a subject result's score cell for both scopes, shared by
 * BroadsheetTable and StudentTermResultCard. A MIDTERM result's max lives in
 * the column header (see `scoreHeader`), so the cell shows the bare mark; a
 * row whose own `scoreMax` differs from `headerMax` (a score recorded under an
 * older quiz max) keeps the "18 / 20" form so it never reads as out of the
 * wrong number. A TERM result carries no `scoreMax` and renders bare.
 */
export function scoreCellText(
  result: { finalScore?: number; scoreMax?: number } | undefined,
  headerMax?: number,
): string {
  if (result?.finalScore == null) {
    return "—";
  }
  return result.scoreMax == null || result.scoreMax === headerMax
    ? String(result.finalScore)
    : `${result.finalScore} / ${result.scoreMax}`;
}

/**
 * Renders a subject's class-average cell (Phase 37, the "Show class average
 * per subject" opt-in) - shared by BroadsheetTable and StudentTermResultCard.
 * `classAverage` is undefined unless the school has turned the setting on
 * (or always, for a QUALITATIVE class); `scoreMax` is the row's own MIDTERM
 * denominator, reused rather than carried separately, and printed bare under
 * the header's max exactly like `scoreCellText`.
 */
export function classAverageCellText(
  classAverage: number | undefined,
  scoreMax: number | undefined,
  headerMax?: number,
): string {
  return scoreCellText({ finalScore: classAverage, scoreMax }, headerMax);
}

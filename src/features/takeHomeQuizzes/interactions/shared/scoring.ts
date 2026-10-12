import type { PartFeedback, ScoreResult, ScoringMode } from "../types";

/**
 * The TS twin of the backend's `ScoringMode.award`/`InteractionScore` (interaction-quiz.md §2),
 * for the author's "Try it" preview only. The share is a ratio of whole numbers and the arithmetic
 * is in integer cents, so half-up rounding is exact and matches Java's `BigDecimal` result - the
 * golden fixtures run through both.
 */
export function award(
  points: number,
  mode: ScoringMode,
  numerator: number,
  denominator: number,
): number {
  if (denominator <= 0 || numerator <= 0) {
    return 0;
  }
  const share = Math.min(numerator, denominator);
  if (mode === "ALL_OR_NOTHING") {
    return share === denominator ? points : 0;
  }
  const pointsCents = Math.round(points * 100);
  // Half-up division of non-negative integers: floor((2a + b) / 2b).
  const cents = Math.floor((2 * pointsCents * share + denominator) / (2 * denominator));
  return cents / 100;
}

/** `points` scaled by `numerator / denominator` - for a type whose share isn't simply its correct parts. */
export function scoreFromShare(
  points: number,
  mode: ScoringMode,
  numerator: number,
  denominator: number,
  parts: PartFeedback[],
): ScoreResult {
  const awarded = award(points, mode, numerator, denominator);
  return { awarded, max: points, partial: awarded > 0 && awarded < points, parts };
}

/** Correct parts over all parts - the default rule; no parts at all scores nothing. */
export function scoreFromParts(
  points: number,
  mode: ScoringMode,
  parts: PartFeedback[],
): ScoreResult {
  const correct = parts.filter((part) => part.correct).length;
  return scoreFromShare(points, mode, correct, parts.length, parts);
}

import { scoreFromParts } from "../shared/scoring";
import type { PartFeedback, ScoreResult, ScoringMode } from "../types";
import type { MatchingConfig, MatchingResponse } from "./types";

/**
 * The TS twin of the backend's `MatchingInteraction` (golden fixtures under
 * `interaction-fixtures/matching`): unknown ids are dropped and, without `reuseRights`, only a
 * right's first use in authored left order stands; then one part per left.
 */
export function normalizeMatching(config: MatchingConfig, response: MatchingResponse | null): Record<string, string> {
  const rightIds = new Set(config.rights.map((right) => right.id));
  const used = new Set<string>();
  const pairs: Record<string, string> = {};
  for (const left of config.lefts) {
    const given = response?.pairs?.[left.id];
    if (!given || !rightIds.has(given)) {
      continue;
    }
    if (config.reuseRights || !used.has(given)) {
      used.add(given);
      pairs[left.id] = given;
    }
  }
  return pairs;
}

export function scoreMatching(
  config: MatchingConfig,
  response: MatchingResponse | null,
  points: number,
  mode: ScoringMode,
): ScoreResult {
  const pairs = normalizeMatching(config, response);
  const parts: PartFeedback[] = config.lefts.map((left) => {
    const given = pairs[left.id] ?? null;
    return {
      partId: left.id,
      correct: given !== null && given === left.rightId,
      expectedRef: left.rightId,
      givenRef: given,
    };
  });
  return scoreFromParts(points, mode, parts);
}

import { scoreFromParts } from "../shared/scoring";
import type { PartFeedback, ScoreResult, ScoringMode } from "../types";
import type { CategorizeConfig, CategorizeResponse } from "./types";

/**
 * The TS twin of the backend's `CategorizeInteraction` (golden fixtures under
 * `interaction-fixtures/categorize`): only a known item placed in a known group stands; then one
 * part per item.
 */
export function normalizeCategorize(
  config: CategorizeConfig,
  response: CategorizeResponse | null,
): Record<string, string> {
  const groupIds = new Set(config.groups.map((group) => group.id));
  const placements: Record<string, string> = {};
  for (const item of config.items) {
    const given = response?.placements?.[item.id];
    if (given && groupIds.has(given)) {
      placements[item.id] = given;
    }
  }
  return placements;
}

export function scoreCategorize(
  config: CategorizeConfig,
  response: CategorizeResponse | null,
  points: number,
  mode: ScoringMode,
): ScoreResult {
  const placements = normalizeCategorize(config, response);
  const parts: PartFeedback[] = config.items.map((item) => {
    const given = placements[item.id] ?? null;
    return {
      partId: item.id,
      correct: given !== null && given === item.groupId,
      expectedRef: item.groupId,
      givenRef: given,
    };
  });
  return scoreFromParts(points, mode, parts);
}

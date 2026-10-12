import { scoreFromParts } from "../shared/scoring";
import type { PartFeedback, ScoreResult, ScoringMode } from "../types";
import type { SequenceConfig, SequenceResponse } from "./types";

/**
 * The TS twin of the backend's `SequenceInteraction#score` (golden fixtures under
 * `interaction-fixtures/sequence`): one part per adjacent pair of the correct order, right when the
 * pair's second item directly follows its first in the student's order. Unknown ids and repeats
 * are dropped first.
 */
export function scoreSequence(
  config: SequenceConfig,
  response: SequenceResponse | null,
  points: number,
  mode: ScoringMode,
): ScoreResult {
  const known = new Set(config.items.map((item) => item.id));
  const order = [...new Set((response?.order ?? []).filter((id) => known.has(id)))];
  const parts: PartFeedback[] = config.items.slice(0, -1).map((item, index) => {
    const expected = config.items[index + 1].id;
    const at = order.indexOf(item.id);
    const given = at >= 0 && at + 1 < order.length ? order[at + 1] : null;
    return { partId: item.id, correct: given === expected, expectedRef: expected, givenRef: given };
  });
  return scoreFromParts(points, mode, parts);
}

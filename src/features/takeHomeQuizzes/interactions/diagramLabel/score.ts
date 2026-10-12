import { scoreFromParts } from "../shared/scoring";
import type { PartFeedback, ScoreResult, ScoringMode } from "../types";
import type { DiagramLabelConfig, DiagramLabelResponse } from "./types";

/**
 * The TS twin of the backend's `DiagramLabelInteraction` (golden fixtures under
 * `interaction-fixtures/diagram_label`): unknown ids are dropped and, without `reuseLabels`, only a
 * label's first use in zone order stands; then one part per zone.
 */
export function normalizeDiagramLabel(
  config: DiagramLabelConfig,
  response: DiagramLabelResponse | null,
): Record<string, string> {
  const labelIds = new Set(config.labels.map((label) => label.id));
  const used = new Set<string>();
  const placements: Record<string, string> = {};
  for (const zone of config.zones) {
    const given = response?.placements?.[zone.id];
    if (!given || !labelIds.has(given)) {
      continue;
    }
    if (config.reuseLabels || !used.has(given)) {
      used.add(given);
      placements[zone.id] = given;
    }
  }
  return placements;
}

export function scoreDiagramLabel(
  config: DiagramLabelConfig,
  response: DiagramLabelResponse | null,
  points: number,
  mode: ScoringMode,
): ScoreResult {
  const placements = normalizeDiagramLabel(config, response);
  const parts: PartFeedback[] = config.zones.map((zone) => {
    const given = placements[zone.id] ?? null;
    return {
      partId: zone.id,
      correct: given !== null && zone.acceptedLabelIds.includes(given),
      expectedRef: zone.acceptedLabelIds[0] ?? null,
      givenRef: given,
    };
  });
  return scoreFromParts(points, mode, parts);
}

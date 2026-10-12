import { clampPoint, contains, type NormalizedPoint } from "../shared/geometry";
import { scoreFromShare } from "../shared/scoring";
import type { PartFeedback, ScoreResult, ScoringMode } from "../types";
import type { HotspotConfig, HotspotResponse } from "./types";

/**
 * The TS twin of the backend's `HotspotInteraction` (golden fixtures under
 * `interaction-fixtures/hotspot`): pins clamped onto the image, exact repeats dropped, only the first
 * `maxPins` kept.
 */
export function normalizeHotspotPins(config: HotspotConfig, response: HotspotResponse | null): NormalizedPoint[] {
  const pins: NormalizedPoint[] = [];
  for (const raw of response?.pins ?? []) {
    if (pins.length >= config.maxPins) {
      break;
    }
    const pin = clampPoint(raw);
    if (!pins.some((kept) => kept.x === pin.x && kept.y === pin.y)) {
      pins.push(pin);
    }
  }
  return pins;
}

/** One part per target, right when a pin is inside it; the share is `max(0, hits - strays) / targets`. */
export function scoreHotspot(
  config: HotspotConfig,
  response: HotspotResponse | null,
  points: number,
  mode: ScoringMode,
): ScoreResult {
  const pins = normalizeHotspotPins(config, response);
  const targets = config.regions.filter((region) => region.target);
  let hits = 0;
  const parts: PartFeedback[] = targets.map((target) => {
    const pin = pins.findIndex((candidate) => contains(target.shape, candidate, config.imageAspect));
    if (pin >= 0) {
      hits++;
    }
    return { partId: target.id, correct: pin >= 0, expectedRef: target.id, givenRef: pin >= 0 ? String(pin) : null };
  });
  const strays = pins.filter(
    (pin) => !targets.some((target) => contains(target.shape, pin, config.imageAspect)),
  ).length;
  return scoreFromShare(points, mode, Math.max(0, hits - strays), targets.length, parts);
}

import type { Shape } from "../shared/geometry";
import { MAX_EXTRA_PINS, MIN_HOTSPOT_TARGETS, type HotspotConfig, type HotspotPlayerConfig, type HotspotRegion } from "./types";

export function hotspotRegionFor(shape: Shape): HotspotRegion {
  return { id: crypto.randomUUID(), shape, target: true, label: null };
}

/** No image or regions yet - the author uploads an image and draws the targets. */
export function blankHotspot(): HotspotConfig {
  return { schemaVersion: 1, imageFileId: null, imageAspect: 1, maxPins: 1, regions: [] };
}

/** The pin allowance `maxPins` must stay within for `regions`' targets - the server clamps to the same. */
export function pinRange(regions: HotspotRegion[]): { min: number; max: number } {
  const min = Math.max(MIN_HOTSPOT_TARGETS, regions.filter((region) => region.target).length);
  return { min, max: min + MAX_EXTRA_PINS };
}

export function toHotspotPlayerView(config: HotspotConfig): HotspotPlayerConfig {
  return { imageFileId: config.imageFileId, imageAspect: config.imageAspect, maxPins: config.maxPins };
}

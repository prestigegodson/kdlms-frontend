import type { NormalizedPoint, Shape } from "../shared/geometry";

/** TS mirrors of the backend's `HotspotConfig`/`HotspotPlayerConfig`/`HotspotResponse` (hotspot.v1.schema.json). */
export interface HotspotRegion {
  id: string;
  shape: Shape;
  /** A target is somewhere students should tap; any other region only names a place in review. */
  target: boolean;
  /** Sanitized rich text naming the region in review ("you tapped the Atlantic"), or `null`. */
  label: string | null;
}

export interface HotspotConfig {
  schemaVersion: 1;
  imageFileId: string | null;
  /** The image's natural width over its height. */
  imageAspect: number;
  /** How many pins a student may drop - from the number of targets up to three more. */
  maxPins: number;
  regions: HotspotRegion[];
}

/** No regions at all - only the image and how many pins. */
export interface HotspotPlayerConfig {
  imageFileId: string | null;
  imageAspect: number;
  maxPins: number;
}

/** The pins a student dropped, in order. */
export interface HotspotResponse {
  pins: NormalizedPoint[];
}

export const MIN_HOTSPOT_TARGETS = 1;
export const MAX_HOTSPOT_TARGETS = 10;
export const MAX_HOTSPOT_REGIONS = 20;
export const MAX_EXTRA_PINS = 3;

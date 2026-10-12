import type { RectShape } from "../shared/geometry";

/** TS mirrors of the backend's `DiagramLabelConfig`/`DiagramLabelPlayerConfig`/`DiagramLabelResponse` (diagram_label.v1.schema.json). */
export interface DiagramZone {
  id: string;
  /** Always a rectangle - a zone is a drop box on the image. */
  shape: RectShape;
  /** The labels that are right for this zone; empty until the author picks one. */
  acceptedLabelIds: string[];
}

export interface DiagramLabel {
  id: string;
  /** Sanitized rich text (the quiz option vocabulary). */
  html: string;
}

/** Labels no zone accepts are distractors. */
export interface DiagramLabelConfig {
  schemaVersion: 1;
  imageFileId: string | null;
  /** The image's natural width over its height. */
  imageAspect: number;
  zones: DiagramZone[];
  labels: DiagramLabel[];
  reuseLabels: boolean;
}

export interface DiagramLabelPlayerConfig {
  imageFileId: string | null;
  imageAspect: number;
  zones: { id: string; shape: RectShape }[];
  labels: { id: string; html: string }[];
  reuseLabels: boolean;
}

/** Zone id to label id; a zone with no entry is empty. */
export interface DiagramLabelResponse {
  placements: Record<string, string>;
}

export const MIN_DIAGRAM_ZONES = 2;
export const MAX_DIAGRAM_ZONES = 20;
export const MAX_DIAGRAM_LABELS = 30;

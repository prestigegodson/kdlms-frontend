/** TS mirrors of the backend's `SequenceConfig`/`SequencePlayerConfig`/`SequenceResponse` (sequence.v1.schema.json). */
export type SequencePresentation = "LIST" | "TIMELINE";

export interface SequenceItem {
  id: string;
  /** Sanitized rich text (the quiz option vocabulary). */
  html: string;
  /** A date or similar, shown only in review. */
  caption?: string | null;
}

/** The authored order is the correct order. */
export interface SequenceConfig {
  schemaVersion: 1;
  presentation: SequencePresentation;
  items: SequenceItem[];
}

export interface SequencePlayerConfig {
  presentation: SequencePresentation;
  items: { id: string; html: string }[];
}

export interface SequenceResponse {
  order: string[];
}

export const MIN_SEQUENCE_ITEMS = 3;
export const MAX_SEQUENCE_ITEMS = 12;
export const MAX_SEQUENCE_CAPTION_LENGTH = 60;

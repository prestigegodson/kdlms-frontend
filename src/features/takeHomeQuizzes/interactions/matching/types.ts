/** TS mirrors of the backend's `MatchingConfig`/`MatchingPlayerConfig`/`MatchingResponse` (matching.v1.schema.json). */
export interface MatchingLeft {
  id: string;
  /** Sanitized rich text (the quiz option vocabulary). */
  html: string;
  /** The right this prompt pairs with; `null` until the author picks one. */
  rightId: string | null;
}

export interface MatchingRight {
  id: string;
  html: string;
}

/** `rights` may include distractors no left pairs with; with `reuseRights` one right may answer several lefts. */
export interface MatchingConfig {
  schemaVersion: 1;
  lefts: MatchingLeft[];
  rights: MatchingRight[];
  reuseRights: boolean;
}

export interface MatchingPlayerConfig {
  lefts: { id: string; html: string }[];
  rights: { id: string; html: string }[];
  reuseRights: boolean;
}

/** Left id to right id; a left with no entry is unanswered. */
export interface MatchingResponse {
  pairs: Record<string, string>;
}

export const MIN_MATCHING_LEFTS = 2;
export const MAX_MATCHING_LEFTS = 12;
export const MAX_MATCHING_RIGHTS = 16;

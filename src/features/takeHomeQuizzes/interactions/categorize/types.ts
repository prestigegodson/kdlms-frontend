/** TS mirrors of the backend's `CategorizeConfig`/`CategorizePlayerConfig`/`CategorizeResponse` (categorize.v1.schema.json). */
export interface CategorizeGroup {
  id: string;
  /** Sanitized rich text (the quiz option vocabulary). */
  html: string;
}

export interface CategorizeItem {
  id: string;
  html: string;
  /** The group this item belongs in; `null` until the author picks one. */
  groupId: string | null;
}

/** Every group should be the answer for at least one item - an empty one is a publish problem. */
export interface CategorizeConfig {
  schemaVersion: 1;
  groups: CategorizeGroup[];
  items: CategorizeItem[];
}

export interface CategorizePlayerConfig {
  groups: { id: string; html: string }[];
  items: { id: string; html: string }[];
}

/** Item id to group id; an item with no entry is unplaced. */
export interface CategorizeResponse {
  placements: Record<string, string>;
}

export const MIN_CATEGORIZE_GROUPS = 2;
export const MAX_CATEGORIZE_GROUPS = 6;
export const MIN_CATEGORIZE_ITEMS = 4;
export const MAX_CATEGORIZE_ITEMS = 30;

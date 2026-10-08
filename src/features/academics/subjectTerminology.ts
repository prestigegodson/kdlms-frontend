import type { LevelView } from "@/api/levels";

/**
 * Base levels whose curriculum is organised as subjects split into learning
 * areas rather than subject groups split into subjects. Keyed off the
 * immutable `baseLevel`, so renaming a level never changes its wording.
 */
const EARLY_YEARS_BASE_LEVELS = new Set(["PRE_SCHOOL", "PRE_NURSERY", "NURSERY"]);

export function isEarlyYearsLevel(level: LevelView | undefined): boolean {
  return level !== undefined && EARLY_YEARS_BASE_LEVELS.has(level.baseLevel);
}

/**
 * The words the subject catalogue uses for a subject (`item`) and a subject
 * group (`group`). UI-only: the API and data model still say subject/group.
 */
export interface SubjectTerms {
  item: string;
  items: string;
  Item: string;
  Items: string;
  group: string;
  groups: string;
  Group: string;
  /** A group named in full where it stands alone, e.g. in an error message. */
  groupFull: string;
  groupsFull: string;
  ungrouped: string;
  /** What happens to a group's members when the group is deleted. */
  groupDeleteNote: string;
}

const DEFAULT_TERMS: SubjectTerms = {
  item: "subject",
  items: "subjects",
  Item: "Subject",
  Items: "Subjects",
  group: "group",
  groups: "groups",
  Group: "Group",
  groupFull: "subject group",
  groupsFull: "subject groups",
  ungrouped: "Ungrouped",
  groupDeleteNote: "Its subjects become ungrouped.",
};

const EARLY_YEARS_TERMS: SubjectTerms = {
  item: "learning area",
  items: "learning areas",
  Item: "Learning area",
  Items: "Learning areas",
  group: "subject",
  groups: "subjects",
  Group: "Subject",
  groupFull: "subject",
  groupsFull: "subjects",
  ungrouped: "No subject",
  groupDeleteNote: "Its learning areas are moved to No subject.",
};

export function subjectTerms(level: LevelView | undefined): SubjectTerms {
  return isEarlyYearsLevel(level) ? EARLY_YEARS_TERMS : DEFAULT_TERMS;
}

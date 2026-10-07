import type { ResourceTarget } from "@/api/learning";

/**
 * A `<select>` value naming one resource target (Phase 35M): a subject's own bare id, or
 * `group:<id>` for a subject group. Subjects stay bare so a `?subjectId=` deep link (SubjectsPage's
 * row action) is already a valid key.
 */
const GROUP_PREFIX = "group:";

export function groupTargetKey(subjectGroupId: string): string {
  return `${GROUP_PREFIX}${subjectGroupId}`;
}

/** The key for an existing target - the group's when it has one, else the subject's. */
export function targetKeyOf(target: Partial<ResourceTarget>): string {
  if (target.subjectGroupId) return groupTargetKey(target.subjectGroupId);
  return target.subjectId ?? "";
}

/** Splits a key back into the request's two mutually exclusive fields; an empty key is neither. */
export function parseTargetKey(key: string): ResourceTarget {
  if (key.startsWith(GROUP_PREFIX)) return { subjectId: null, subjectGroupId: key.slice(GROUP_PREFIX.length) };
  return { subjectId: key || null, subjectGroupId: null };
}

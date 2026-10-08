/**
 * What a subject-or-group picker selects: exactly one of a subject or a subject group (learning
 * resources since Phase 35M, take-home quizzes since they gained group targets). An empty key is
 * neither.
 */
export interface SubjectTarget {
  subjectId: string | null;
  subjectGroupId: string | null;
}

/**
 * A `<select>` value naming one target: a subject's own bare id, or `group:<id>` for a subject
 * group. Subjects stay bare so a `?subjectId=` deep link (SubjectsPage's row actions) is already a
 * valid key.
 */
const GROUP_PREFIX = "group:";

export function groupTargetKey(subjectGroupId: string): string {
  return `${GROUP_PREFIX}${subjectGroupId}`;
}

/** The key for an existing target - the group's when it has one, else the subject's. */
export function targetKeyOf(target: Partial<SubjectTarget>): string {
  if (target.subjectGroupId) return groupTargetKey(target.subjectGroupId);
  return target.subjectId ?? "";
}

/** Splits a key back into the request's two mutually exclusive fields; an empty key is neither. */
export function parseTargetKey(key: string): SubjectTarget {
  if (key.startsWith(GROUP_PREFIX)) return { subjectId: null, subjectGroupId: key.slice(GROUP_PREFIX.length) };
  return { subjectId: key || null, subjectGroupId: null };
}

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

/** A subject as a grouped picker lists it - `levelName` is set only where subjects span levels (the admin catalogue). */
export interface GroupableSubject {
  subjectId: string;
  subjectName: string;
  subjectGroupId?: string | null;
  subjectGroupName?: string | null;
  levelName?: string;
}

/** One group's run of a grouped picker - `selectable` when the group itself may be picked as a target. */
export interface SubjectSection<S extends GroupableSubject> {
  subjectGroupId: string;
  label: string;
  selectable: boolean;
  subjects: S[];
}

/** A subject's (or a group heading's) display text, naming its level where subjects span levels. */
export function withLevelName(name: string, levelName: string | undefined): string {
  return levelName ? `${name} (${levelName})` : name;
}

/**
 * Sections `subjects` under their own subject group, for a subject picker: groups alphabetically,
 * subjects alphabetically within each, and the ungrouped subjects trailing in their incoming order -
 * the result sheet's own sectioning rule (`reporting.domain.SubjectRowSections`). A group in
 * `selectableGroups` is marked selectable and listed even when none of its subjects are in
 * `subjects`; any other group is a heading only. With no group at all, `sections` is empty and
 * `ungrouped` is `subjects` unchanged.
 */
export function groupSubjects<S extends GroupableSubject>(
  subjects: S[],
  selectableGroups: { subjectGroupId: string; subjectGroupName: string }[] = [],
): { sections: SubjectSection<S>[]; ungrouped: S[] } {
  const selectableIds = new Set(selectableGroups.map((group) => group.subjectGroupId));
  const sectionsById = new Map<string, SubjectSection<S>>();
  const ungrouped: S[] = [];
  for (const subject of subjects) {
    if (!subject.subjectGroupId) {
      ungrouped.push(subject);
      continue;
    }
    let section = sectionsById.get(subject.subjectGroupId);
    if (!section) {
      section = {
        subjectGroupId: subject.subjectGroupId,
        label: withLevelName(subject.subjectGroupName ?? "", subject.levelName),
        selectable: selectableIds.has(subject.subjectGroupId),
        subjects: [],
      };
      sectionsById.set(subject.subjectGroupId, section);
    }
    section.subjects.push(subject);
  }
  for (const group of selectableGroups) {
    if (!sectionsById.has(group.subjectGroupId)) {
      sectionsById.set(group.subjectGroupId, {
        subjectGroupId: group.subjectGroupId,
        label: group.subjectGroupName,
        selectable: true,
        subjects: [],
      });
    }
  }
  const byName = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: "base" });
  const sections = [...sectionsById.values()].sort((a, b) => byName(a.label, b.label));
  for (const section of sections) section.subjects.sort((a, b) => byName(a.subjectName, b.subjectName));
  return { sections, ungrouped };
}

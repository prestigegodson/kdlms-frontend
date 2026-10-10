import {
  type GroupableSubject,
  groupSubjects,
  groupTargetKey,
  withLevelName,
} from "@/features/academics/subjectTarget";

interface SubjectTargetOptionsProps {
  subjects: GroupableSubject[];
  /** The groups the caller may pick as a target - every other group is a heading only. */
  subjectGroups?: { subjectGroupId: string; subjectGroupName: string }[];
  /** The empty option's text; `null` renders no empty option (a picker that always has a value). */
  placeholder?: string | null;
}

/** Indents a subject listed under a selectable group's own option - a native `<option>` can't nest. */
const INDENT = "    ";

/**
 * The `<option>`s of a subject (or subject-or-group, see `subjectTarget.ts`) `<Select>`, with every
 * subject listed under its own group (`groupSubjects`). A group the caller may target is itself an
 * option, its subjects indented after it; any other group is a non-selectable `<optgroup>` heading.
 * Ungrouped subjects trail under "Other subjects" - or, when nothing is grouped, the list stays flat.
 * Shared by the Learning resources and CBT/Quizzes pages, the resource editor, and the lesson-notes
 * subject picker.
 */
export function SubjectTargetOptions({
  subjects,
  subjectGroups = [],
  placeholder = "Select a subject…",
}: SubjectTargetOptionsProps) {
  const { sections, ungrouped } = groupSubjects(subjects, subjectGroups);
  const subjectOption = (subject: GroupableSubject, prefix = "") => (
    <option key={subject.subjectId} value={subject.subjectId}>
      {`${prefix}${withLevelName(subject.subjectName, subject.levelName)}`}
    </option>
  );
  return (
    <>
      {placeholder !== null && <option value="">{placeholder}</option>}
      {sections.length === 0
        ? ungrouped.map((subject) => subjectOption(subject))
        : (
          <>
            {sections.map((section) =>
              section.selectable ? (
                [
                  <option key={section.subjectGroupId} value={groupTargetKey(section.subjectGroupId)}>
                    {section.label}
                  </option>,
                  ...section.subjects.map((subject) => subjectOption(subject, INDENT)),
                ]
              ) : (
                <optgroup key={section.subjectGroupId} label={section.label}>
                  {section.subjects.map((subject) => subjectOption(subject))}
                </optgroup>
              ),
            )}
            {ungrouped.length > 0 && (
              <optgroup label="Other subjects">{ungrouped.map((subject) => subjectOption(subject))}</optgroup>
            )}
          </>
        )}
    </>
  );
}

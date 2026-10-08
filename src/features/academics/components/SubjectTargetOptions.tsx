import { groupTargetKey } from "@/features/academics/subjectTarget";

interface SubjectTargetOptionsProps {
  subjects: { subjectId: string; subjectName: string }[];
  subjectGroups: { subjectGroupId: string; subjectGroupName: string }[];
  placeholder?: string;
}

/**
 * The `<option>`s of a subject-or-group filter `<Select>` (see `subjectTarget.ts`): the subject
 * groups first, then the subjects, each under its own heading - or just the subjects when the
 * caller may author no group. Shared by the Learning resources and CBT/Quizzes list pages.
 */
export function SubjectTargetOptions({
  subjects,
  subjectGroups,
  placeholder = "Select a subject…",
}: SubjectTargetOptionsProps) {
  const subjectOptions = subjects.map((subject) => (
    <option key={subject.subjectId} value={subject.subjectId}>
      {subject.subjectName}
    </option>
  ));
  return (
    <>
      <option value="">{placeholder}</option>
      {subjectGroups.length === 0 ? (
        subjectOptions
      ) : (
        <>
          <optgroup label="Subject groups">
            {subjectGroups.map((group) => (
              <option key={group.subjectGroupId} value={groupTargetKey(group.subjectGroupId)}>
                {group.subjectGroupName}
              </option>
            ))}
          </optgroup>
          <optgroup label="Subjects">{subjectOptions}</optgroup>
        </>
      )}
    </>
  );
}

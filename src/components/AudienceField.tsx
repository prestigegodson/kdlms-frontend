import { type ReactNode, useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Checkbox } from "@/components/ui/Checkbox";
import { Input } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";

export type Audience = "ALL" | "SELECTED";

/** One pickable pupil - the shape both `takehomequiz`'s and `learning`'s backend `EligibleStudentView` share. */
export interface AudienceStudent {
  studentId: string;
  fullName: string;
  admissionNumber: string | null;
  classId: string;
  className: string;
  portalLogin: boolean;
}

interface AudienceFieldProps {
  /** Radio-group name and checkbox id prefix - unique per form. */
  name: string;
  audience: Audience;
  /** The chosen students - only meaningful while `audience` is `SELECTED`. */
  selected: ReadonlySet<string>;
  onChange: (audience: Audience, selected: Set<string>) => void;
  /** Every student of the classrooms the item reaches; `null` while loading (or when it couldn't be listed). */
  students: AudienceStudent[] | null;
  /** A chosen student that can't be unticked any more (a quiz someone has submitted only grows). */
  isLocked?: (studentId: string) => boolean;
  /** "Selected pupils" can't be picked; `narrowingLockedNote` explains why. */
  narrowingLocked?: boolean;
  narrowingLockedNote?: string;
  /** The short tag after a pupil without a portal login, e.g. "link". */
  noLoginTag: string;
  /** What ticking a pupil means for this item, shown under the list. */
  footnote: ReactNode;
  disabled?: boolean;
}

/**
 * Who a take-home quiz or learning resource goes to: every student of its classrooms (the default),
 * or only the students ticked here - a retake, remedial work, one group's material. The list is
 * grouped by classroom, with a search box and a per-classroom Select all / Clear all, and stays a
 * bounded scrolling box however big the classrooms are.
 */
export function AudienceField({
  name,
  audience,
  selected,
  onChange,
  students,
  isLocked,
  narrowingLocked = false,
  narrowingLockedNote,
  noLoginTag,
  footnote,
  disabled = false,
}: AudienceFieldProps) {
  const [query, setQuery] = useState("");
  const groups = useMemo(() => groupByClass(students ?? [], query), [students, query]);
  const chosenCount = students ? students.filter((student) => selected.has(student.studentId)).length : selected.size;

  function toggle(studentId: string) {
    const next = new Set(selected);
    if (next.has(studentId)) next.delete(studentId);
    else next.add(studentId);
    onChange("SELECTED", next);
  }

  /** Ticks or clears one classroom's visible students, never unticking a locked one. */
  function toggleClass(group: ClassGroup) {
    const changeable = group.students.filter((student) => !isLocked?.(student.studentId));
    const allChosen = changeable.every((student) => selected.has(student.studentId));
    const next = new Set(selected);
    changeable.forEach((student) => (allChosen ? next.delete(student.studentId) : next.add(student.studentId)));
    onChange("SELECTED", next);
  }

  return (
    <fieldset className="space-y-2" disabled={disabled}>
      <legend className="text-sm font-medium text-slate-700">Pupils</legend>
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="radio"
            name={name}
            className="h-4 w-4 border-slate-300 text-brand-500"
            checked={audience === "ALL"}
            onChange={() => onChange("ALL", new Set(selected))}
          />
          All pupils in these classrooms
        </label>
        <label className={`flex items-center gap-2 text-sm ${narrowingLocked ? "text-slate-400" : "text-slate-700"}`}>
          <input
            type="radio"
            name={name}
            className="h-4 w-4 border-slate-300 text-brand-500"
            checked={audience === "SELECTED"}
            disabled={narrowingLocked}
            onChange={() => onChange("SELECTED", new Set(selected))}
          />
          Selected pupils
          {audience === "SELECTED" && <Badge variant="brand">{chosenCount} chosen</Badge>}
        </label>
      </div>
      {narrowingLocked && audience === "ALL" && narrowingLockedNote && (
        <p className="text-xs text-slate-500">{narrowingLockedNote}</p>
      )}

      {audience === "SELECTED" && (
        <div className="space-y-2">
          {students === null ? (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Spinner /> Loading pupils…
            </div>
          ) : students.length === 0 ? (
            <p className="text-sm text-slate-500">No pupils are enrolled in these classrooms yet.</p>
          ) : (
            <>
              <Input
                type="search"
                aria-label="Search pupils"
                placeholder="Search by name or admission number"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <div className="max-h-72 space-y-3 overflow-y-auto rounded-control border border-slate-200 p-2">
                {groups.length === 0 && <p className="px-1 py-1 text-sm text-slate-500">No pupils match.</p>}
                {groups.map((group) => {
                  const changeable = group.students.filter((student) => !isLocked?.(student.studentId));
                  const allChosen =
                    changeable.length > 0 && changeable.every((student) => selected.has(student.studentId));
                  return (
                    <div key={group.classId} className="space-y-0.5">
                      <div className="flex items-center justify-between px-1">
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          {group.className}
                        </span>
                        {!disabled && changeable.length > 1 && (
                          <button
                            type="button"
                            className="text-sm font-medium text-brand-600 hover:underline"
                            onClick={() => toggleClass(group)}
                          >
                            {allChosen ? "Clear all" : "Select all"}
                          </button>
                        )}
                      </div>
                      {group.students.map((student) => {
                        const locked = isLocked?.(student.studentId) ?? false;
                        return (
                          <label
                            key={student.studentId}
                            className={`flex items-center gap-2 rounded px-1 py-1 text-sm ${
                              locked ? "text-slate-400" : "text-slate-700 hover:bg-slate-50"
                            }`}
                          >
                            <Checkbox
                              id={`${name}-student-${student.studentId}`}
                              checked={locked || selected.has(student.studentId)}
                              disabled={disabled || locked}
                              onChange={() => toggle(student.studentId)}
                            />
                            {student.fullName}
                            {student.admissionNumber && (
                              <span className="text-xs text-slate-500"> · {student.admissionNumber}</span>
                            )}
                            {!student.portalLogin && <span className="text-xs text-slate-500"> · {noLoginTag}</span>}
                          </label>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </>
          )}
          <p className="text-xs text-slate-500">{footnote}</p>
        </div>
      )}
    </fieldset>
  );
}

interface ClassGroup {
  classId: string;
  className: string;
  students: AudienceStudent[];
}

function groupByClass(students: AudienceStudent[], query: string): ClassGroup[] {
  const needle = query.trim().toLowerCase();
  const groups = new Map<string, ClassGroup>();
  for (const student of students) {
    if (
      needle &&
      !student.fullName.toLowerCase().includes(needle) &&
      !(student.admissionNumber ?? "").toLowerCase().includes(needle)
    ) {
      continue;
    }
    let group = groups.get(student.classId);
    if (!group) {
      group = { classId: student.classId, className: student.className, students: [] };
      groups.set(student.classId, group);
    }
    group.students.push(student);
  }
  return [...groups.values()];
}

import type { LessonNoteWeekView } from "@/api/lessonNotes";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";
import { LessonNoteStatusBadge } from "@/features/lessonNotes/components/LessonNoteStatusBadge";

interface WeekGridTableProps {
  weeks: LessonNoteWeekView[];
  /** The subject whose weekly notes these are - or, for a whole-class grid, omit it and pass `classId`. */
  subjectId?: string;
  classId?: string;
  termId: string;
  /** Carried into a new week's editor link so a SCHOOL_ADMIN saves into the branch they're browsing. */
  branchId?: string;
  /**
   * False when the caller may only read these notes (a class teacher's subject that has a
   * subject teacher, or a subject teacher viewing a class's whole-class notes) - a week with no note then isn't a link, since there is nothing to read and
   * the editor would offer a blank note they can't save.
   */
  authorable?: boolean;
}

function formatRange(weekStart: string, weekEnd: string): string {
  const format = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `${format(weekStart)} – ${format(weekEnd)}`;
}

/**
 * One row per week of the selected subject+term, whether or not a note
 * exists yet - each row opens the editor, addressed by `noteId` when one
 * exists or the literal `"new"` plus the week's own subjectId/termId/
 * weekNumber in the query string otherwise (a not-yet-authored week has no
 * id to route on). A whole-class grid carries `classId` in place of
 * `subjectId`.
 */
export function WeekGridTable({
  weeks,
  subjectId,
  classId,
  termId,
  branchId,
  authorable = true,
}: WeekGridTableProps) {
  const scope = classId ? `classId=${classId}` : `subjectId=${subjectId ?? ""}`;
  return (
    <Table>
      <TableHead>
        <TableRow>
          <TableHeaderCell>Week</TableHeaderCell>
          <TableHeaderCell>Dates</TableHeaderCell>
          <TableHeaderCell>Topic</TableHeaderCell>
          <TableHeaderCell>Status</TableHeaderCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {weeks.map((week) => {
          const editorId = week.noteId ?? "new";
          const to =
            `/school/lesson-notes/${editorId}` +
            `?${scope}&termId=${termId}&weekNumber=${week.weekNumber}` +
            (branchId ? `&branchId=${branchId}` : "");
          return (
            <TableRow key={week.weekNumber} to={authorable || week.noteId ? to : undefined}>
              <TableCell label="Week">Week {week.weekNumber}</TableCell>
              <TableCell label="Dates">{formatRange(week.weekStart, week.weekEnd)}</TableCell>
              <TableCell label="Topic">{week.topic ?? <span className="text-slate-400">No topic yet</span>}</TableCell>
              <TableCell label="Status">
                <LessonNoteStatusBadge status={week.status} />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

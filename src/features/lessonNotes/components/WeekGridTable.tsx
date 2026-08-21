import type { LessonNoteWeekView } from "@/api/lessonNotes";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";
import { LessonNoteStatusBadge } from "@/features/lessonNotes/components/LessonNoteStatusBadge";

interface WeekGridTableProps {
  weeks: LessonNoteWeekView[];
  subjectId: string;
  termId: string;
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
 * id to route on).
 */
export function WeekGridTable({ weeks, subjectId, termId }: WeekGridTableProps) {
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
            `?subjectId=${subjectId}&termId=${termId}&weekNumber=${week.weekNumber}`;
          return (
            <TableRow key={week.weekNumber} to={to}>
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

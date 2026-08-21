import type { LessonNoteQueueView } from "@/api/lessonNotes";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";
import { LessonNoteStatusBadge } from "@/features/lessonNotes/components/LessonNoteStatusBadge";

interface ReviewQueueTableProps {
  rows: LessonNoteQueueView[];
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/** One row per queued note - opens the same editor `WeekGridTable` uses, now addressed by its real id. */
export function ReviewQueueTable({ rows }: ReviewQueueTableProps) {
  return (
    <Table>
      <TableHead>
        <TableRow>
          <TableHeaderCell>Subject</TableHeaderCell>
          <TableHeaderCell>Level</TableHeaderCell>
          <TableHeaderCell>Term</TableHeaderCell>
          <TableHeaderCell>Week</TableHeaderCell>
          <TableHeaderCell>Topic</TableHeaderCell>
          <TableHeaderCell>Status</TableHeaderCell>
          <TableHeaderCell>Submitted</TableHeaderCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((row) => {
          const to = `/school/lesson-notes/${row.id}?subjectId=${row.subjectId}&termId=${row.termId}&weekNumber=${row.weekNumber}`;
          return (
            <TableRow key={row.id} to={to}>
              <TableCell label="Subject">{row.subjectName ?? "—"}</TableCell>
              <TableCell label="Level">{row.levelName ?? "—"}</TableCell>
              <TableCell label="Term">{row.termName ?? "—"}</TableCell>
              <TableCell label="Week">Week {row.weekNumber}</TableCell>
              <TableCell label="Topic">{row.topic}</TableCell>
              <TableCell label="Status">
                <LessonNoteStatusBadge status={row.status} />
              </TableCell>
              <TableCell label="Submitted">
                {formatDateTime(row.submittedAt)}
                {row.submittedByName ? ` · ${row.submittedByName}` : ""}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

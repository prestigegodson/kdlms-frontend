import type { ResourceCompletionsView, StudentCompletionView } from "@/api/learning";
import { Badge } from "@/components/ui/Badge";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";
import { RegisterProgress } from "@/features/attendance/components/RegisterProgress";
import { formatInstant } from "@/utils/date";

type RowStatus = "COMPLETED" | "OPENED" | "NOT_OPENED";

function statusOf(row: StudentCompletionView): RowStatus {
  if (row.completed) return "COMPLETED";
  if (row.lastOpenedAt) return "OPENED";
  return "NOT_OPENED";
}

const STATUS_LABELS: Record<RowStatus, string> = {
  COMPLETED: "Completed",
  OPENED: "Opened",
  NOT_OPENED: "Not opened",
};

const STATUS_VARIANTS: Record<RowStatus, "success" | "info" | "neutral"> = {
  COMPLETED: "success",
  OPENED: "info",
  NOT_OPENED: "neutral",
};

interface CompletionsPanelProps {
  completions: ResourceCompletionsView;
  /** The roster column's heading - "Student" unless overridden (creators Phase C14: "Learner"). */
  personLabel?: string;
}

/**
 * The staff-facing per-student completion roster for one resource (Phase 35H) - one row per
 * roster student, joined server-side against `learning_resource_interactions` in a single batched
 * read (`ManageInteractionsService#completions`). Purely presentational, the `ResultsTable` shape
 * (props in, no fetching of its own) - `CompletionsModal` is the fetch-then-render wrapper. The
 * three-state badge (`Completed` / `Opened` / `Not opened`) is derived here from `completed` and
 * `lastOpenedAt` alone, never re-fetched or re-derived server-side twice.
 */
export function CompletionsPanel({ completions, personLabel = "Student" }: CompletionsPanelProps) {
  // A resource shared across several arms has one roster spanning them all - name each row's class then.
  const showsClass = new Set(completions.students.map((row) => row.className).filter(Boolean)).size > 1;
  return (
    <div className="space-y-4">
      <RegisterProgress
        markedCount={completions.completedCount}
        totalCount={completions.totalStudents}
        verbLabel="completed"
      />

      <Table>
        <TableHead>
          <TableRow>
            <TableHeaderCell>{personLabel}</TableHeaderCell>
            {showsClass && <TableHeaderCell>Class</TableHeaderCell>}
            <TableHeaderCell>Status</TableHeaderCell>
            <TableHeaderCell>Last opened</TableHeaderCell>
            <TableHeaderCell>Completed</TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {completions.students.map((row) => {
            const status = statusOf(row);
            return (
              <TableRow key={row.studentId}>
                <TableCell label={personLabel}>
                  <div>
                    <div className="font-medium text-slate-900">{row.studentName}</div>
                    {row.admissionNumber && <div className="text-xs text-slate-500">{row.admissionNumber}</div>}
                  </div>
                </TableCell>
                {showsClass && <TableCell label="Class">{row.className}</TableCell>}
                <TableCell label="Status">
                  <Badge variant={STATUS_VARIANTS[status]}>{STATUS_LABELS[status]}</Badge>
                </TableCell>
                <TableCell label="Last opened">
                  {row.lastOpenedAt ? formatInstant(row.lastOpenedAt) : "—"}
                </TableCell>
                <TableCell label="Completed">
                  {row.completedAt ? formatInstant(row.completedAt) : "—"}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

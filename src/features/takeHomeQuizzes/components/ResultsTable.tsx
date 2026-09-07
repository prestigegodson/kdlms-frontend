import type { StudentResultRowView, TakeHomeQuizAttemptState } from "@/api/takeHomeQuizzes";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";

interface ResultsTableProps {
  rows: StudentResultRowView[];
  totalPoints: number;
  canAdjust: boolean;
  canReset: boolean;
  onViewAnswers: (row: StudentResultRowView) => void;
  onAdjust: (row: StudentResultRowView) => void;
  onClearAdjustment: (row: StudentResultRowView) => void;
  onReset: (row: StudentResultRowView) => void;
}

const STATE_LABELS: Record<TakeHomeQuizAttemptState, string> = {
  NOT_STARTED: "Not started",
  IN_PROGRESS: "In progress",
  SUBMITTED: "Submitted",
};

const STATE_VARIANTS: Record<TakeHomeQuizAttemptState, "neutral" | "info" | "success"> = {
  NOT_STARTED: "neutral",
  IN_PROGRESS: "info",
  SUBMITTED: "success",
};

function formatScore(score: number | null, totalPoints: number): string {
  return score === null ? "—" : `${score} / ${totalPoints}`;
}

/**
 * The roster-wide grading grid (Phase 20E) - one row per student, `Table`
 * with `TableCell label` props so it stacks below `md`, the same
 * `StudentLinksPanel` shape. A bare `TableRow` (no row-level `to`/`onClick`)
 * since the Actions cell already carries its own buttons.
 */
export function ResultsTable({
  rows,
  totalPoints,
  canAdjust,
  canReset,
  onViewAnswers,
  onAdjust,
  onClearAdjustment,
  onReset,
}: ResultsTableProps) {
  return (
    <Table>
      <TableHead>
        <TableRow>
          <TableHeaderCell>Student</TableHeaderCell>
          <TableHeaderCell>State</TableHeaderCell>
          <TableHeaderCell>Score</TableHeaderCell>
          <TableHeaderCell>Submitted</TableHeaderCell>
          <TableHeaderCell>Actions</TableHeaderCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.studentId}>
            <TableCell label="Student">
              <div>
                <div className="font-medium text-slate-900">{row.fullName}</div>
                <div className="text-xs text-slate-500">{row.admissionNumber}</div>
              </div>
            </TableCell>
            <TableCell label="State">
              <Badge variant={STATE_VARIANTS[row.attemptState]}>
                {STATE_LABELS[row.attemptState]}
              </Badge>
              {row.autoSubmitted && (
                <span className="ml-2 text-xs text-slate-500">Auto-submitted</span>
              )}
            </TableCell>
            <TableCell label="Score">
              <div className="flex items-center gap-2">
                <span>{formatScore(row.effectiveScore, totalPoints)}</span>
                {!!row.adjustedScore && <Badge variant="warning">Adjusted</Badge>}
              </div>
              {!!row.adjustedScore && (
                <div className="text-xs text-slate-500">
                  Auto: {formatScore(row.autoScore, totalPoints)}
                </div>
              )}
            </TableCell>
            <TableCell label="Submitted">
              {row.submittedAt ? new Date(row.submittedAt).toLocaleString() : "—"}
            </TableCell>
            <TableCell label="Actions">
              <div className="flex flex-wrap gap-2">
                {row.attemptState === "SUBMITTED" && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onViewAnswers(row)}
                  >
                    View answers
                  </Button>
                )}
                {canAdjust && row.attemptState === "SUBMITTED" && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => onAdjust(row)}>
                    Adjust
                  </Button>
                )}
                {canAdjust && row.adjustedScore !== null && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onClearAdjustment(row)}
                  >
                    Clear adjustment
                  </Button>
                )}
                {canReset && row.attemptState !== "NOT_STARTED" && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => onReset(row)}>
                    Reset
                  </Button>
                )}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

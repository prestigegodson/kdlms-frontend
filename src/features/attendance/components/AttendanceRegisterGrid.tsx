import { useEffect, useState } from "react";
import { useBlocker } from "react-router";
import {
  type AttendanceRegisterView,
  type AttendanceStatus,
  type RowOutcome,
  saveRegister,
} from "@/api/attendance";
import { ApiError } from "@/api/client";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ui/Table";
import { statusBadgeVariant, statusRailClass } from "@/features/attendance/attendanceStatus";
import { RegisterProgress } from "@/features/attendance/components/RegisterProgress";
import { StatusSegments } from "@/features/attendance/components/StatusSegments";
import { XCircle } from "lucide-react";

function draftsFromRegister(
  register: AttendanceRegisterView,
): Record<string, AttendanceStatus | undefined> {
  const drafts: Record<string, AttendanceStatus | undefined> = {};
  for (const row of register.rows) {
    drafts[row.studentId] = row.status;
  }
  return drafts;
}

interface AttendanceRegisterGridProps {
  register: AttendanceRegisterView;
  onSaved: (outcomes: RowOutcome[]) => void;
}

/**
 * The register itself. When `register.editable` is false (an admin's
 * read-only view, or a date the calling teacher can no longer mark), it
 * renders a plain status badge per row and nothing else - no segments, no
 * save bar. When editable, drafts + a dirty set track local edits exactly
 * like `assessments/components/ScoreEntryGrid`, with one difference: saving
 * is blocked until every student has a status (CLAUDE.md's "no partial
 * saves" rule), so `RegisterProgress` and the save bar both foreground how
 * much is left rather than just going grey.
 */
export function AttendanceRegisterGrid({ register, onSaved }: AttendanceRegisterGridProps) {
  const [drafts, setDrafts] = useState<Record<string, AttendanceStatus | undefined>>(() =>
    draftsFromRegister(register),
  );
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Adopt a newly loaded register (new selection, or a post-save reload) by comparing
  // against the last-seen register during render, same technique ScoreEntryGrid uses.
  const [lastRegister, setLastRegister] = useState(register);
  if (register !== lastRegister) {
    setLastRegister(register);
    setDrafts(draftsFromRegister(register));
    setDirty(new Set());
  }

  const blocker = useBlocker(dirty.size > 0);

  useEffect(() => {
    function handler(event: BeforeUnloadEvent) {
      if (dirty.size > 0) event.preventDefault();
    }
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const totalCount = register.rows.length;
  const markedCount = register.rows.filter((row) => drafts[row.studentId]).length;
  const remaining = totalCount - markedCount;
  const complete = remaining === 0 && totalCount > 0;

  function setStatus(studentId: string, status: AttendanceStatus) {
    setDrafts((current) => ({ ...current, [studentId]: status }));
    setDirty((current) => new Set(current).add(studentId));
  }

  function discard() {
    setDrafts(draftsFromRegister(register));
    setDirty(new Set());
  }

  function focusRow(rowIndex: number) {
    document.getElementById(`att-${rowIndex}-PRESENT`)?.focus();
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const entries = register.rows
        .filter((row) => drafts[row.studentId])
        .map((row) => ({
          studentId: row.studentId,
          status: drafts[row.studentId] as AttendanceStatus,
        }));
      const outcome = await saveRegister(register.classId, register.date, entries);
      setDirty(new Set());
      onSaved(outcome.outcomes);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save the register");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 pb-4">
      {error && <Alert variant="error">{error}</Alert>}

      {register.editable && <RegisterProgress markedCount={markedCount} totalCount={totalCount} />}

      <Table>
        <TableHead>
          <TableRow>
            <TableHeaderCell>Student</TableHeaderCell>
            <TableHeaderCell>Status</TableHeaderCell>
            <TableHeaderCell>Recorded by</TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {register.rows.map((row, index) => {
            const status = drafts[row.studentId];
            return (
              <TableRow key={row.studentId} className={`border-l-2 ${statusRailClass(status)}`}>
                <TableCell label="Student">
                  <span className="font-medium text-slate-900">{row.studentName}</span>
                  <span className="block text-xs text-slate-500">{row.admissionNumber}</span>
                </TableCell>
                <TableCell label="Status">
                  {register.editable ? (
                    <StatusSegments
                      id={`att-${index}`}
                      value={status}
                      studentName={row.studentName}
                      onChange={(next) => setStatus(row.studentId, next)}
                      onAdvance={() => focusRow(index + 1)}
                    />
                  ) : status ? (
                    <Badge variant={statusBadgeVariant(status)}>{status}</Badge>
                  ) : (
                    <span className="text-slate-400">Not marked</span>
                  )}
                </TableCell>
                <TableCell label="Recorded by">{row.recordedByName ?? "—"}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {register.editable && (
        <RegisterSaveBar
          dirtyCount={dirty.size}
          remaining={remaining}
          complete={complete}
          saving={saving}
          onSave={handleSave}
          onDiscard={discard}
        />
      )}

      {blocker.state === "blocked" && (
        <ConfirmDialog
          title="Leave without saving?"
          message="You have unsaved attendance changes on this register that will be lost."
          confirmLabel="Leave"
          variant="danger"
          onConfirm={async () => {
            blocker.proceed();
          }}
          onClose={() => blocker.reset()}
        />
      )}
    </div>
  );
}

interface RegisterSaveBarProps {
  dirtyCount: number;
  remaining: number;
  complete: boolean;
  saving: boolean;
  onSave: () => void;
  onDiscard: () => void;
}

/**
 * The one accent CTA on this view. Unlike `UnsavedChangesBar`, saving stays
 * disabled until every student is marked - CLAUDE.md's "no partial saves"
 * rule - so the bar states what's left rather than just going grey.
 */
function RegisterSaveBar({
  dirtyCount,
  remaining,
  complete,
  saving,
  onSave,
  onDiscard,
}: RegisterSaveBarProps) {
  if (dirtyCount === 0) return null;

  return (
    <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <p className="text-sm text-slate-600">
        {complete
          ? `${dirtyCount} unsaved change${dirtyCount === 1 ? "" : "s"}`
          : `Mark ${remaining} more student${remaining === 1 ? "" : "s"} to save`}
      </p>
      <div className="flex gap-2">
        <Button type="button" variant="ghost" disabled={saving} onClick={onDiscard}>
          Discard
        </Button>
        <Button
          type="button"
          variant="accent"
          loading={saving}
          disabled={!complete}
          onClick={onSave}
        >
          Mark register
        </Button>
      </div>
    </div>
  );
}

interface AttendanceOutcomeListProps {
  outcomes: RowOutcome[];
  nameOf: (studentId: string) => string;
}

/**
 * Per-row save results, same "N of M succeeded" shape as assessments' SaveOutcomeList.
 * Successful rows collapse into the summary count only - for a full class that's dozens
 * of redundant ticks - and only failed rows (with their reason) are listed, since that's
 * the one thing a teacher can't already see from the register they just filled in.
 */
export function AttendanceOutcomeList({ outcomes, nameOf }: AttendanceOutcomeListProps) {
  const successCount = outcomes.filter((outcome) => outcome.success).length;
  const failures = outcomes.filter((outcome) => !outcome.success);

  return (
    <Alert
      variant={failures.length === 0 ? "success" : "warning"}
      title={
        failures.length === 0
          ? "Register saved"
          : `Register saved with ${failures.length} problem${failures.length === 1 ? "" : "s"}`
      }
    >
      <p>
        {successCount} of {outcomes.length} saved successfully.
      </p>
      {failures.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {failures.map((outcome) => (
            <li key={outcome.studentId} className="flex items-start gap-2">
              <XCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                <span className="font-medium">{nameOf(outcome.studentId)}</span>
                {outcome.message && <span> &mdash; {outcome.message}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Alert>
  );
}

import { useEffect, useState } from "react";
import { useBlocker } from "react-router";
import {
  type RemarksSheetView,
  type RowOutcome,
  saveTeacherRemarks,
  savePrincipalRemarks,
} from "@/api/assessments";
import { ApiError } from "@/api/client";
import { Alert } from "@/components/ui/Alert";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Table, TableBody, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";
import { RegisterProgress } from "@/features/attendance/components/RegisterProgress";
import { type RemarkField, RemarkEntryRow } from "@/features/assessments/components/RemarkEntryRow";
import { UnsavedChangesBar } from "@/features/assessments/components/UnsavedChangesBar";

function draftsFromSheet(sheet: RemarksSheetView, field: RemarkField): Record<string, string> {
  const drafts: Record<string, string> = {};
  for (const row of sheet.rows) {
    drafts[row.enrollmentId] = (field === "classTeacher" ? row.classTeacherRemark : row.principalRemark) ?? "";
  }
  return drafts;
}

interface RemarksEntryGridProps {
  sheet: RemarksSheetView;
  /** Which half this caller writes - the class teacher's own remark, or the admin's separate principal remark. */
  field: RemarkField;
  onSaved: (outcomes: RowOutcome[]) => void;
}

/**
 * The remarks entry grid, shared verbatim by `RemarksPanel` (a class
 * teacher writing `classTeacher`) and `AdminResultsPanel`'s principal
 * composer (`principal`) - the "one component, two callers" precedent
 * `ThreadCard`/`AttendanceSummaryPanel` already set. Whether the field
 * renders as an editable Textarea or plain text is the server's own
 * `classTeacherEditable`/`principalRemarkEditable` flag, never re-derived
 * here - the same trust-the-server shape `AttendanceRegisterGrid` uses for
 * `register.editable`.
 */
export function RemarksEntryGrid({ sheet, field, onSaved }: RemarksEntryGridProps) {
  const editable = field === "classTeacher" ? sheet.classTeacherEditable : sheet.principalRemarkEditable;

  const [drafts, setDrafts] = useState<Record<string, string>>(() => draftsFromSheet(sheet, field));
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A new sheet is adopted by comparing against the last-seen sheet during render -
  // see ScoreEntryGrid's identical comment for why this isn't an effect.
  const [lastSheet, setLastSheet] = useState(sheet);
  if (sheet !== lastSheet) {
    setLastSheet(sheet);
    setDrafts(draftsFromSheet(sheet, field));
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

  const totalCount = sheet.rows.length;
  const markedCount = sheet.rows.filter((row) => (drafts[row.enrollmentId] ?? "").trim() !== "").length;

  function updateCell(enrollmentId: string, value: string) {
    setDrafts((current) => ({ ...current, [enrollmentId]: value }));
    setDirty((current) => new Set(current).add(enrollmentId));
  }

  function discard() {
    setDrafts(draftsFromSheet(sheet, field));
    setDirty(new Set());
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const entries = Array.from(dirty).map((enrollmentId) => ({
        enrollmentId,
        remark: drafts[enrollmentId].trim() === "" ? null : drafts[enrollmentId],
      }));
      const outcome =
        field === "classTeacher"
          ? await saveTeacherRemarks(sheet.classId, sheet.termId, entries)
          : await savePrincipalRemarks(sheet.classId, sheet.termId, entries);
      setDirty(new Set());
      onSaved(outcome.outcomes);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save remarks");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 pb-4">
      {error && <Alert variant="error">{error}</Alert>}

      {editable && (
        <RegisterProgress markedCount={markedCount} totalCount={totalCount} verbLabel="written" />
      )}

      <Table>
        <TableHead>
          <TableRow>
            <TableHeaderCell>Student</TableHeaderCell>
            <TableHeaderCell>{field === "classTeacher" ? "Class teacher's remark" : "Principal's remark"}</TableHeaderCell>
            {field === "principal" && <TableHeaderCell>Class teacher's remark</TableHeaderCell>}
          </TableRow>
        </TableHead>
        <TableBody>
          {sheet.rows.map((row) => (
            <RemarkEntryRow
              key={row.enrollmentId}
              row={row}
              field={field}
              value={drafts[row.enrollmentId] ?? ""}
              editable={editable}
              dirty={dirty.has(row.enrollmentId)}
              onChange={(value) => updateCell(row.enrollmentId, value)}
            />
          ))}
        </TableBody>
      </Table>

      {editable && <UnsavedChangesBar count={dirty.size} saving={saving} onSave={handleSave} onDiscard={discard} />}

      {blocker.state === "blocked" && (
        <ConfirmDialog
          title="Leave without saving?"
          message="You have unsaved remark changes on this sheet that will be lost."
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

import { Sparkles } from "lucide-react";
import type { RemarkSheetRow } from "@/api/assessments";
import { Button } from "@/components/ui/Button";
import { TableCell, TableRow } from "@/components/ui/Table";
import { Textarea } from "@/components/ui/Textarea";

export type RemarkField = "classTeacher" | "principal";

interface RemarkEntryRowProps {
  row: RemarkSheetRow;
  field: RemarkField;
  /** The column's own heading - "Class teacher's remark", or the class's resolved "<Title>'s remark" for the principal composer (see `RemarksEntryGrid`). */
  label: string;
  value: string;
  editable: boolean;
  dirty: boolean;
  onChange: (value: string) => void;
  /** Opens the AI draft sheet for this pupil - omitted when the caller can't draft with AI. */
  onDraftWithAi?: () => void;
}

/**
 * One student's remark row - a single Textarea for whichever half the
 * caller may write (`field`), plus, for the principal composer only, the
 * class teacher's own remark shown read-only alongside it for context.
 * Behavioural-trait ratings (Phase 15) render on their own tab via
 * `TraitEntryRow` instead of as extra columns here - see
 * `RemarksEntryGrid`'s tab switch. An editable row may also offer an
 * "AI draft" button (insights Phase I5), which only ever fills the Textarea.
 */
export function RemarkEntryRow({ row, field, label, value, editable, dirty, onChange, onDraftWithAi }: RemarkEntryRowProps) {
  return (
    <TableRow className={dirty ? "border-l-2 border-l-brand-500" : ""}>
      <TableCell label="Pupil">
        <span className="font-medium text-slate-900">{row.studentName}</span>
        <span className="block text-xs text-slate-500">{row.admissionNumber}</span>
      </TableCell>
      <TableCell label={label}>
        {editable ? (
          <>
            <Textarea
              aria-label={`${label} for ${row.studentName}`}
              rows={2}
              className={dirty ? "border-brand-400" : ""}
              value={value}
              onChange={(event) => onChange(event.target.value)}
            />
            {onDraftWithAi && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-1"
                aria-label={`AI draft for ${row.studentName}`}
                onClick={onDraftWithAi}
              >
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                AI draft
              </Button>
            )}
          </>
        ) : (
          <span className="text-slate-500">{value || "—"}</span>
        )}
      </TableCell>
      {field === "principal" && (
        <TableCell label="Class teacher's remark" className="text-slate-500">
          {row.classTeacherRemark || "—"}
          {row.classTeacherRemarkByName && (
            <span className="block text-xs text-slate-400">— {row.classTeacherRemarkByName}</span>
          )}
        </TableCell>
      )}
    </TableRow>
  );
}

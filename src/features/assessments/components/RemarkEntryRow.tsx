import type { RemarkSheetRow } from "@/api/assessments";
import { TableCell, TableRow } from "@/components/ui/Table";
import { Textarea } from "@/components/ui/Textarea";

export type RemarkField = "classTeacher" | "principal";

interface RemarkEntryRowProps {
  row: RemarkSheetRow;
  field: RemarkField;
  value: string;
  editable: boolean;
  dirty: boolean;
  onChange: (value: string) => void;
}

/**
 * One student's remark row - a single Textarea for whichever half the
 * caller may write (`field`), plus, for the principal composer only, the
 * class teacher's own remark shown read-only alongside it for context. Its
 * own component (rather than inlined in `RemarksEntryGrid`) so Phase 15 can
 * add a trait tap-grid onto this same row without reshaping the grid around
 * it - see `remarks-plan.md`.
 */
export function RemarkEntryRow({ row, field, value, editable, dirty, onChange }: RemarkEntryRowProps) {
  const label = field === "classTeacher" ? "Class teacher's remark" : "Principal's remark";

  return (
    <TableRow className={dirty ? "border-l-2 border-l-brand-500" : ""}>
      <TableCell label="Student">
        <span className="font-medium text-slate-900">{row.studentName}</span>
        <span className="block text-xs text-slate-500">{row.admissionNumber}</span>
      </TableCell>
      <TableCell label={label}>
        {editable ? (
          <Textarea
            aria-label={`${label} for ${row.studentName}`}
            rows={2}
            className={dirty ? "border-brand-400" : ""}
            value={value}
            onChange={(event) => onChange(event.target.value)}
          />
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

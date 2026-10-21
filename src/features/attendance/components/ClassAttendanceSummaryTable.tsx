import type { ClassAttendanceSummaryView } from "@/api/attendance";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/ui/Table";
import { useSchoolSettingsStore } from "@/stores/schoolSettingsStore";

interface ClassAttendanceSummaryTableProps {
  summary: ClassAttendanceSummaryView;
  onSelectStudent?: (studentId: string) => void;
}

/**
 * A class's per-student attendance totals for one term. A two-session school
 * counts each register once, so its denominator reads "Registers marked".
 */
export function ClassAttendanceSummaryTable({
  summary,
  onSelectStudent,
}: ClassAttendanceSummaryTableProps) {
  const markedLabel = useSchoolSettingsStore((state) => state.settings?.twoSessionAttendance)
    ? "Registers marked"
    : "Days marked";

  return (
    <Table>
      <TableHead>
        <TableRow>
          <TableHeaderCell>Pupil</TableHeaderCell>
          <TableHeaderCell numeric>Present</TableHeaderCell>
          <TableHeaderCell numeric>Absent</TableHeaderCell>
          <TableHeaderCell numeric>Late</TableHeaderCell>
          <TableHeaderCell numeric>Excused</TableHeaderCell>
          <TableHeaderCell numeric>{markedLabel}</TableHeaderCell>
          <TableHeaderCell numeric>Rate</TableHeaderCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {summary.rows.map((row) => (
          <TableRow key={row.studentId}>
            <TableCell label="Pupil">
              {onSelectStudent ? (
                <button
                  type="button"
                  className="text-left font-medium text-brand-500 hover:text-brand-600"
                  onClick={() => onSelectStudent(row.studentId)}
                >
                  {row.studentName}
                </button>
              ) : (
                <span className="font-medium text-slate-900">{row.studentName}</span>
              )}
              <span className="block text-xs text-slate-500">{row.admissionNumber}</span>
            </TableCell>
            <TableCell label="Present" numeric>
              {row.present}
            </TableCell>
            <TableCell label="Absent" numeric>
              {row.absent}
            </TableCell>
            <TableCell label="Late" numeric>
              {row.late}
            </TableCell>
            <TableCell label="Excused" numeric>
              {row.excused}
            </TableCell>
            <TableCell label={markedLabel} numeric>
              {row.daysMarked}
            </TableCell>
            <TableCell label="Rate" numeric>
              {row.attendanceRate.toFixed(1)}%
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

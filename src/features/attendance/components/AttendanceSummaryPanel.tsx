import type { StudentAttendanceSummaryView } from "@/api/attendance";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatTile } from "@/components/ui/StatTile";
import { statusBadgeVariant } from "@/features/attendance/attendanceStatus";
import { AttendanceMonthGroup } from "@/features/attendance/components/AttendanceMonthGroup";
import { groupDaysByMonth } from "@/features/attendance/groupDaysByMonth";
import { formatLongDate, formatMonthName } from "@/utils/date";

interface AttendanceSummaryPanelProps {
  summary: StudentAttendanceSummaryView;
}

/**
 * The presentational half of a student's per-term attendance summary - stat
 * tiles plus a day-by-day list grouped into collapsible months (the most
 * recent expanded, earlier ones closed until tapped), or an empty state when
 * nothing's been marked yet. Extracted out of `StudentAttendanceCard` (which
 * fetches via the staff `getStudentTermSummary` and owns its own
 * session/term cascade) so the guardian portal's `WardAttendancePage` (which
 * fetches via `getWardAttendance` and has its own ward/term selectors) can
 * render the identical summary without duplicating this markup.
 */
export function AttendanceSummaryPanel({ summary }: AttendanceSummaryPanelProps) {
  if (summary.daysMarked === 0) {
    return (
      <EmptyState
        title="No attendance recorded"
        description="Nobody has marked this student's register this term yet."
      />
    );
  }

  const months = groupDaysByMonth(summary.days);

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatTile label="Present" value={summary.present} />
        <StatTile label="Absent" value={summary.absent} />
        <StatTile label="Late" value={summary.late} />
        <StatTile label="Excused" value={summary.excused} />
        <StatTile label="Rate" value={`${summary.attendanceRate.toFixed(1)}%`} />
      </div>
      <div className="mt-4 divide-y divide-slate-100">
        {months.map(([monthKey, days], index) => (
          <AttendanceMonthGroup
            key={monthKey}
            monthName={formatMonthName(days[0].date)}
            dayCount={days.length}
            defaultOpen={index === months.length - 1}
          >
            {days.map((day) => (
              <li key={day.date} className="flex items-center justify-between border-b border-slate-100 py-1.5 last:border-0">
                <span className="text-slate-600">{formatLongDate(day.date)}</span>
                <Badge variant={statusBadgeVariant(day.status)}>{day.status}</Badge>
              </li>
            ))}
          </AttendanceMonthGroup>
        ))}
      </div>
    </>
  );
}

import { useEffect, useState } from "react";
import { type AttendanceOverviewView, getDailyOverview } from "@/api/attendance";
import { ApiError } from "@/api/client";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { todayIso } from "@/utils/date";

interface AttendanceTodayCardProps {
  /** Defaults to today; a standalone component (not just an AdminAttendancePanel section) so Phase 9's dashboard landing page can drop it in unchanged. */
  date?: string;
}

/** Which classes have taken today's register and which haven't - SCHOOL_ADMIN/BRANCH_ADMIN only. */
export function AttendanceTodayCard({ date = todayIso() }: AttendanceTodayCardProps) {
  const [overview, setOverview] = useState<AttendanceOverviewView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // A date change resets downstream state during render (see ScoreEntryGrid's
  // comment on this pattern) rather than in an effect; the effect below only fetches.
  const [lastDate, setLastDate] = useState(date);
  if (date !== lastDate) {
    setLastDate(date);
    setOverview(null);
    setLoadError(null);
  }

  useEffect(() => {
    getDailyOverview(date)
      .then(setOverview)
      .catch((error: unknown) =>
        setLoadError(
          error instanceof ApiError ? error.message : "Failed to load today's attendance",
        ),
      );
  }, [date]);

  const allMarked =
    overview !== null &&
    overview.totalClasses > 0 &&
    overview.classesMarked === overview.totalClasses;

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-900">Today&rsquo;s attendance</h2>
        {overview && overview.totalClasses > 0 && (
          <Badge variant={allMarked ? "success" : "neutral"}>
            {overview.classesMarked} of {overview.totalClasses} classes marked
          </Badge>
        )}
      </div>

      {loadError && (
        <Alert variant="error" className="mt-3">
          {loadError}
        </Alert>
      )}
      {!loadError && !overview && (
        <div className="mt-3 flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading…
        </div>
      )}
      {overview && overview.totalClasses === 0 && (
        <p className="mt-3 text-sm text-slate-500">No classes exist yet.</p>
      )}
      {overview && overview.totalClasses > 0 && (
        <ul className="mt-4 divide-y divide-slate-100">
          {overview.classes.map((row) => (
            <li key={row.classId} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span className="font-medium text-slate-900">{row.className}</span>
              {row.marked ? (
                <span className="text-slate-500">
                  {row.present} present &middot; {row.absent} absent &middot; {row.late} late
                  &middot; {row.excused} excused
                </span>
              ) : (
                <Badge variant="warning">Not marked yet</Badge>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

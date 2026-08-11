import { useEffect, useMemo, useState } from "react";
import { type AttendanceOverviewView, type ClassOverviewRow, getDailyOverview } from "@/api/attendance";
import { ApiError } from "@/api/client";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { AttendanceLevelGroup } from "@/features/attendance/components/AttendanceLevelGroup";
import { useLevelStore } from "@/stores/levelStore";
import { todayIso } from "@/utils/date";

const OTHER_LEVEL_KEY = "__other__";

interface LevelGroup {
  key: string;
  levelName: string;
  classes: ClassOverviewRow[];
}

/** Groups overview rows by level, ordered by the school's level rank - a level with no resolvable name trails as "Other". */
function groupByLevel(
  classes: ClassOverviewRow[],
  levelRanks: Map<string, number>,
): LevelGroup[] {
  const groups = new Map<string, LevelGroup>();
  for (const row of classes) {
    const key = row.levelName ? row.levelId : OTHER_LEVEL_KEY;
    const existing = groups.get(key);
    if (existing) {
      existing.classes.push(row);
    } else {
      groups.set(key, { key, levelName: row.levelName ?? "Other", classes: [row] });
    }
  }

  return [...groups.values()].sort((a, b) => {
    if (a.key === OTHER_LEVEL_KEY) return 1;
    if (b.key === OTHER_LEVEL_KEY) return -1;
    const rankA = levelRanks.get(a.key);
    const rankB = levelRanks.get(b.key);
    if (rankA !== undefined && rankB !== undefined) return rankA - rankB;
    if (rankA !== undefined) return -1;
    if (rankB !== undefined) return 1;
    return a.levelName.localeCompare(b.levelName);
  });
}

interface AttendanceTodayCardProps {
  /** Defaults to today; a standalone component (not just an AdminAttendancePanel section) so Phase 9's dashboard landing page can drop it in unchanged. */
  date?: string;
}

/** Which classes have taken today's register and which haven't - SCHOOL_ADMIN/BRANCH_ADMIN only. */
export function AttendanceTodayCard({ date = todayIso() }: AttendanceTodayCardProps) {
  const [overview, setOverview] = useState<AttendanceOverviewView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const levels = useLevelStore((state) => state.levels);
  const fetchLevels = useLevelStore((state) => state.fetchIfNeeded);

  useEffect(() => {
    fetchLevels();
  }, [fetchLevels]);

  const levelRanks = useMemo(() => new Map(levels.map((level) => [level.id, level.rank])), [levels]);
  const levelGroups = useMemo(
    () => (overview ? groupByLevel(overview.classes, levelRanks) : []),
    [overview, levelRanks],
  );

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
        <div className="mt-4 divide-y divide-slate-100">
          {levelGroups.map((group) => (
            <AttendanceLevelGroup
              key={group.key}
              levelName={group.levelName}
              classesMarked={group.classes.filter((row) => row.marked).length}
              totalClasses={group.classes.length}
            >
              {group.classes.map((row) => (
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
            </AttendanceLevelGroup>
          ))}
        </div>
      )}
    </Card>
  );
}

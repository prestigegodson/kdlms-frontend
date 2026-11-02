import { Check, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import type { AttendanceStatus, DayEntry } from "@/api/attendance";
import { ApiError } from "@/api/client";
import { getWardsWeekAttendance, type MyWardView, type WardWeekAttendanceView } from "@/api/wards";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Spinner } from "@/components/ui/Spinner";
import { sessionLabel } from "@/features/attendance/attendanceStatus";
import { groupWardsBySchool } from "@/features/guardian/groupWardsBySchool";
import { useWardStore } from "@/stores/wardStore";
import { addDaysIso, parseIsoDate, startOfWeekIso, todayIso } from "@/utils/date";

const WEEKDAY_FORMATTER = new Intl.DateTimeFormat("en-GB", { weekday: "short" });
const SHORT_MONTH_FORMATTER = new Intl.DateTimeFormat("en-GB", { month: "short" });

const STATUS_LABELS: Record<AttendanceStatus, string> = {
  PRESENT: "Present",
  LATE: "Late",
  ABSENT: "Absent",
  EXCUSED: "Excused",
};

/** "2026-10-26" -> "26 Oct". */
function dayAndShortMonth(iso: string): string {
  const date = parseIsoDate(iso);
  return date ? `${date.getDate()} ${SHORT_MONTH_FORMATTER.format(date)}` : iso;
}

/** "2026-10-26", "2026-10-30" -> "26 Oct – 30 Oct 2026". */
function weekLabel(monday: string, friday: string): string {
  return `${dayAndShortMonth(monday)} – ${dayAndShortMonth(friday)} ${friday.slice(0, 4)}`;
}

function StatusMark({ status }: { status: AttendanceStatus }) {
  switch (status) {
    case "PRESENT":
      return <Check className="h-5 w-5 text-green-600" strokeWidth={3} aria-hidden />;
    case "LATE":
      return <Check className="h-5 w-5 text-amber-600" strokeWidth={3} aria-hidden />;
    case "ABSENT":
      return <X className="h-5 w-5 text-red-600" strokeWidth={3} aria-hidden />;
    case "EXCUSED":
      return (
        <span className="text-sm font-semibold leading-5 text-slate-500" aria-hidden>
          E
        </span>
      );
  }
}

/**
 * One ward's marks for one day. A two-session school has up to two entries
 * (morning first), so each mark carries its session in its label; a
 * once-a-day school's single mark is labelled by status alone.
 */
function DayCell({ entries, dayLabel }: { entries: DayEntry[]; dayLabel: string }) {
  if (entries.length === 0) {
    return null;
  }
  const twoSessions = entries.length > 1;
  return (
    <div className="flex items-center justify-center gap-1">
      {entries.map((entry) => {
        const label = twoSessions
          ? `${dayLabel} ${sessionLabel(entry.session)}: ${STATUS_LABELS[entry.status]}`
          : `${dayLabel}: ${STATUS_LABELS[entry.status]}`;
        return (
          <span key={entry.session} role="img" aria-label={label} title={label} className="inline-flex">
            <StatusMark status={entry.status} />
          </span>
        );
      })}
    </div>
  );
}

function Legend() {
  const items: AttendanceStatus[] = ["PRESENT", "LATE", "ABSENT", "EXCUSED"];
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500">
      {items.map((status) => (
        <li key={status} className="flex items-center gap-1.5">
          <StatusMark status={status} />
          {STATUS_LABELS[status]}
        </li>
      ))}
      <li className="flex items-center gap-1.5">
        <span className="inline-block h-5 w-5 rounded border border-dashed border-slate-300" aria-hidden />
        Not marked
      </li>
    </ul>
  );
}

type WeekState =
  | { status: "loading"; data: WardWeekAttendanceView | null }
  | { status: "loaded"; data: WardWeekAttendanceView }
  | { status: "error"; data: WardWeekAttendanceView | null; message: string };

/**
 * The guardian's attendance home: every linked ward as a row, Monday to
 * Friday as columns, one week at a time (`<` / `>`; never past the current
 * week, which has nothing to show). One request per week covers every ward
 * at every school (`GET /me/wards/attendance/week`). Each ward's name opens
 * the existing term drill-down (`WardAttendanceLayout` and its pages) for
 * term totals and history.
 */
export function WardAttendancePage() {
  const { wards, status, errorMessage, fetchIfNeeded, retry } = useWardStore();
  const currentWeek = startOfWeekIso(new Date());
  const today = todayIso();
  const [weekStart, setWeekStart] = useState(currentWeek);
  const [weekState, setWeekState] = useState<WeekState>({ status: "loading", data: null });
  const [retryToken, setRetryToken] = useState(0);
  const hasWards = status === "loaded" && wards.length > 0;

  useEffect(() => {
    fetchIfNeeded();
  }, [fetchIfNeeded]);

  // A week change (or retry) flips back to loading during render - the
  // pattern `WardResultsLayout` documents - rather than inside the effect,
  // which only fetches. The ward rows stay put, so the table doesn't jump.
  const [lastRequest, setLastRequest] = useState(`${weekStart}:${retryToken}`);
  if (`${weekStart}:${retryToken}` !== lastRequest) {
    setLastRequest(`${weekStart}:${retryToken}`);
    setWeekState((previous) => ({ status: "loading", data: previous.data }));
  }

  useEffect(() => {
    if (!hasWards) return;
    let cancelled = false;
    getWardsWeekAttendance(weekStart)
      .then((data) => {
        if (!cancelled) setWeekState({ status: "loaded", data });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setWeekState((previous) => ({
          status: "error",
          data: previous.data,
          message: error instanceof ApiError ? error.message : "Failed to load attendance",
        }));
      });
    return () => {
      cancelled = true;
    };
  }, [hasWards, weekStart, retryToken]);

  const days = [0, 1, 2, 3, 4].map((offset) => addDaysIso(weekStart, offset));
  const daysByStudent = new Map<string, DayEntry[]>();
  // Only marks for the week on screen - a previous week's data is never drawn under this week's dates.
  const data = weekState.data?.weekStart === weekStart ? weekState.data : null;
  for (const ward of data?.wards ?? []) {
    daysByStudent.set(ward.studentId, ward.days);
  }
  const isCurrentWeek = weekStart >= currentWeek;
  const loadingWeek = weekState.status === "loading";
  const multiSchool = groupWardsBySchool(wards).length > 1;

  function renderWardRow(ward: MyWardView) {
    const entries = daysByStudent.get(ward.studentId) ?? [];
    return (
      <tr key={ward.studentId} className="divide-x divide-slate-200">
        <th scope="row" className="py-3 pl-4 pr-3 text-left font-normal">
          <Link
            to={`/guardian/attendance/${ward.studentId}`}
            className="font-medium text-brand-600 hover:text-brand-700 hover:underline"
          >
            {ward.fullName}
          </Link>
          {ward.currentClassName && <div className="text-xs text-slate-500">{ward.currentClassName}</div>}
        </th>
        {days.map((day) => (
          <td key={day} className={`px-2 py-3 text-center ${day === today ? "bg-brand-50" : ""}`}>
            <DayCell
              entries={entries.filter((entry) => entry.date === day)}
              dayLabel={`${WEEKDAY_FORMATTER.format(parseIsoDate(day) ?? new Date())} ${dayAndShortMonth(day)}`}
            />
          </td>
        ))}
      </tr>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Attendance" description="This week's attendance for your wards." />

      {(status === "idle" || status === "loading") && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading…
        </div>
      )}
      {status === "error" && <ErrorState message={errorMessage ?? "Failed to load your wards"} onRetry={retry} />}
      {status === "loaded" && wards.length === 0 && (
        <EmptyState title="No wards linked yet" description="Contact your school if you believe this is a mistake." />
      )}

      {hasWards && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              aria-label="Previous week"
              onClick={() => setWeekStart((current) => addDaysIso(current, -7))}
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </Button>
            <h2 className="min-w-[11rem] text-center font-display text-sm font-semibold text-slate-900" aria-live="polite">
              {weekLabel(days[0], days[4])}
            </h2>
            <Button
              variant="secondary"
              size="sm"
              aria-label="Next week"
              disabled={isCurrentWeek}
              onClick={() => setWeekStart((current) => addDaysIso(current, 7))}
            >
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Button>
            {!isCurrentWeek && (
              <Button variant="ghost" size="sm" onClick={() => setWeekStart(currentWeek)}>
                This week
              </Button>
            )}
            {loadingWeek && <Spinner />}
          </div>

          {weekState.status === "error" && (
            <Alert variant="error">
              <span>{weekState.message}</span>{" "}
              <button
                type="button"
                className="font-medium underline"
                onClick={() => setRetryToken((token) => token + 1)}
              >
                Try again
              </button>
            </Alert>
          )}

          <div className="overflow-x-auto rounded-card border border-slate-200 bg-white shadow-sm">
            <table className={`min-w-full text-sm transition-opacity ${loadingWeek ? "opacity-60" : ""}`}>
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr className="divide-x divide-slate-200">
                  <th scope="col" className="py-2.5 pl-4 pr-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Ward
                  </th>
                  {days.map((day) => {
                    const date = parseIsoDate(day);
                    return (
                      <th
                        key={day}
                        scope="col"
                        className={`w-14 px-2 py-2.5 text-center text-xs font-semibold text-slate-500 sm:w-20 ${
                          day === today ? "bg-brand-50 text-brand-700" : ""
                        }`}
                      >
                        <div className="uppercase tracking-wide">{date ? WEEKDAY_FORMATTER.format(date) : ""}</div>
                        <div className="font-normal tabular-nums">{date?.getDate()}</div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {multiSchool
                  ? groupWardsBySchool(wards).flatMap(([schoolName, schoolWards]) => [
                      <tr key={`school-${schoolName}`} className="bg-slate-50/60">
                        <th
                          scope="colgroup"
                          colSpan={6}
                          className="px-4 py-2 text-left font-display text-xs font-semibold uppercase tracking-wide text-slate-500"
                        >
                          {schoolName}
                        </th>
                      </tr>,
                      ...schoolWards.map(renderWardRow),
                    ])
                  : wards.map(renderWardRow)}
              </tbody>
            </table>
          </div>

          <Legend />
        </div>
      )}
    </div>
  );
}

import { CalendarDays, ChevronLeft, ChevronRight, List } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { getErrorMessage } from "@/api/client";
import {
  type Occurrence,
  type OccurrenceCalendar,
  type VirtualClass,
  listOccurrences,
  listVirtualClasses,
} from "@/api/virtualClasses";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { Select } from "@/components/ui/Select";
import { Spinner } from "@/components/ui/Spinner";
import { SessionList } from "../components/SessionList";
import { SessionsMonthCalendar } from "../components/SessionsMonthCalendar";
import { addDays, addMonths, dateInZone, monthGrid, monthLabel, monthOf } from "../scheduleUtils";

type SessionsView = "calendar" | "list";

const VIEW_KEY = "kdlms.creatorSessions.view";
/** The occurrences endpoint's widest range - and wider than the 8 weeks sessions exist ahead. */
const LOOKAHEAD_DAYS = 61;

function storedView(): SessionsView {
  try {
    return window.localStorage.getItem(VIEW_KEY) === "list" ? "list" : "calendar";
  } catch {
    return "calendar";
  }
}

function rememberView(view: SessionsView) {
  try {
    window.localStorage.setItem(VIEW_KEY, view);
  } catch {
    // Storage blocked - the choice just isn't remembered.
  }
}

/** The next session the creator will run: a live one, or the first not yet over. */
function nextSession(occurrences: Occurrence[], now: number): Occurrence | undefined {
  return occurrences.find(
    (o) =>
      o.status === "LIVE" ||
      (o.status !== "CANCELLED" && o.status !== "ENDED" && Date.parse(o.scheduledEnd) > now),
  );
}

/**
 * Every session across the creator's active classes, a month at a time, in their own timezone -
 * as a calendar (the default) or a day-grouped list, with join, attendance and reschedule/cancel
 * on each session (creators.md Phase C4). It opens on the month of the next upcoming session.
 */
export function SessionsCalendarPage() {
  const [classes, setClasses] = useState<VirtualClass[]>([]);
  const [timezone, setTimezone] = useState<string | null>(null);
  const [month, setMonth] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [view, setView] = useState<SessionsView>(storedView);
  const [classId, setClassId] = useState("");
  const [calendar, setCalendar] = useState<OccurrenceCalendar | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listVirtualClasses()
      .then(async (list) => {
        const zone = list.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
        const today = dateInZone(new Date(), zone);
        const ahead = await listOccurrences(today, addDays(today, LOOKAHEAD_DAYS));
        if (cancelled) return;
        const next = nextSession(ahead.occurrences, Date.now());
        const start = next ? dateInZone(next.scheduledStart, ahead.timezone) : today;
        setClasses(list.classes.filter((c) => c.status === "ACTIVE"));
        setTimezone(ahead.timezone);
        setMonth(monthOf(start));
        setSelectedDate(start);
      })
      .catch((loadError: unknown) => {
        if (!cancelled) setError(getErrorMessage(loadError, "Failed to load your sessions."));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const [reloads, setReloads] = useState(0);
  const reload = useCallback(() => setReloads((n) => n + 1), []);

  useEffect(() => {
    if (!month) return;
    let cancelled = false;
    const grid = monthGrid(month);
    listOccurrences(grid[0], grid[grid.length - 1], classId || undefined)
      .then((loaded) => {
        if (cancelled) return;
        setCalendar(loaded);
        setError(null);
      })
      .catch((loadError: unknown) => {
        if (!cancelled) setError(getErrorMessage(loadError, "Failed to load sessions."));
      });
    return () => {
      cancelled = true;
    };
  }, [month, classId, reloads]);

  const today = timezone ? dateInZone(new Date(), timezone) : null;

  const goToMonth = (next: string) => {
    setMonth(next);
    setSelectedDate((current) =>
      current && monthOf(current) === next
        ? current
        : today && monthOf(today) === next
          ? today
          : `${next}-01`,
    );
  };

  const selectDate = (date: string) => {
    setSelectedDate(date);
    if (monthOf(date) !== month) setMonth(monthOf(date));
  };

  const changeView = (next: SessionsView) => {
    setView(next);
    rememberView(next);
  };

  const monthSessions =
    calendar && month
      ? calendar.occurrences.filter(
          (o) => monthOf(dateInZone(o.scheduledStart, calendar.timezone)) === month,
        )
      : [];

  return (
    <div className="space-y-6">
      <PageHeader title="Sessions" description="Your sessions across every class, by month." />
      {error && <Alert variant="error">{error}</Alert>}
      {month && timezone && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1">
            <Button
              variant="secondary"
              size="sm"
              aria-label="Previous month"
              onClick={() => goToMonth(addMonths(month, -1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="secondary"
              size="sm"
              aria-label="Next month"
              onClick={() => goToMonth(addMonths(month, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <h2 className="text-base font-semibold text-slate-900" aria-live="polite">
            {monthLabel(month)}
          </h2>
          {today && monthOf(today) !== month && (
            <Button variant="ghost" size="sm" onClick={() => goToMonth(monthOf(today))}>
              Today
            </Button>
          )}
          <div className="ml-auto flex flex-wrap items-center gap-3">
            {classes.length > 1 && (
              <div>
                <label className="sr-only" htmlFor="sessions-class">
                  Class
                </label>
                <Select
                  id="sessions-class"
                  value={classId}
                  onChange={(e) => setClassId(e.target.value)}
                >
                  <option value="">All classes</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </div>
            )}
            <div
              role="group"
              aria-label="View"
              className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5"
            >
              {(
                [
                  { value: "calendar", label: "Calendar", icon: CalendarDays },
                  { value: "list", label: "List", icon: List },
                ] as const
              ).map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={view === value}
                  aria-label={`${label} view`}
                  onClick={() => changeView(value)}
                  className={`flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium mobile:min-h-11 mobile:min-w-11 mobile:justify-center ${
                    view === value
                      ? "bg-white text-brand-700 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  <span className="hidden sm:inline">{label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      {calendar === null && !error && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading sessions…
        </div>
      )}
      {calendar && month && selectedDate && view === "calendar" && (
        <SessionsMonthCalendar
          month={month}
          occurrences={calendar.occurrences}
          timezone={calendar.timezone}
          selectedDate={selectedDate}
          onSelectDate={selectDate}
          onChanged={reload}
        />
      )}
      {calendar && view === "list" && (
        <>
          <p className="text-xs text-slate-500">Times are in {calendar.timezone}.</p>
          <SessionList
            occurrences={monthSessions}
            timezone={calendar.timezone}
            showClassName
            emptyMessage={
              classes.length === 0 ? "You have no active classes yet." : "No sessions this month."
            }
            onChanged={reload}
          />
        </>
      )}
    </div>
  );
}

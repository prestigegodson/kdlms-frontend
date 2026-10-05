import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { getErrorMessage } from "@/api/client";
import {
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
import { addDays, dateInZone, mondayOf, shortDate } from "../scheduleUtils";

/**
 * A week-at-a-time agenda of every session across the creator's active classes, in their own
 * timezone, with reschedule/cancel on each upcoming one (creators.md Phase C4).
 */
export function SessionsCalendarPage() {
  const [classes, setClasses] = useState<VirtualClass[]>([]);
  const [timezone, setTimezone] = useState<string | null>(null);
  const [weekStart, setWeekStart] = useState<string | null>(null);
  const [classId, setClassId] = useState("");
  const [calendar, setCalendar] = useState<OccurrenceCalendar | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listVirtualClasses()
      .then((list) => {
        const zone = list.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
        setClasses(list.classes.filter((c) => c.status === "ACTIVE"));
        setTimezone(zone);
        setWeekStart(mondayOf(dateInZone(new Date(), zone)));
      })
      .catch((loadError: unknown) =>
        setError(getErrorMessage(loadError, "Failed to load your classes.")),
      );
  }, []);

  const load = useCallback(() => {
    if (!weekStart) return;
    listOccurrences(weekStart, addDays(weekStart, 6), classId || undefined)
      .then((loaded) => {
        setCalendar(loaded);
        setError(null);
      })
      .catch((loadError: unknown) =>
        setError(getErrorMessage(loadError, "Failed to load sessions.")),
      );
  }, [weekStart, classId]);

  useEffect(load, [load]);

  const thisWeek = timezone ? mondayOf(dateInZone(new Date(), timezone)) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sessions"
        description="Every upcoming session across your classes, week by week."
      />
      {error && <Alert variant="error">{error}</Alert>}
      {weekStart && timezone && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1">
            <Button
              variant="secondary"
              size="sm"
              aria-label="Previous week"
              onClick={() => setWeekStart(addDays(weekStart, -7))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="secondary"
              size="sm"
              aria-label="Next week"
              onClick={() => setWeekStart(addDays(weekStart, 7))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-sm font-medium text-slate-900">
            {shortDate(weekStart)} – {shortDate(addDays(weekStart, 6))}
          </p>
          {weekStart !== thisWeek && thisWeek && (
            <Button variant="ghost" size="sm" onClick={() => setWeekStart(thisWeek)}>
              This week
            </Button>
          )}
          {classes.length > 1 && (
            <div className="sm:ml-auto">
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
        </div>
      )}
      {calendar === null && !error && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading sessions…
        </div>
      )}
      {calendar && (
        <>
          <p className="text-xs text-slate-500">Times are in {calendar.timezone}.</p>
          <SessionList
            occurrences={calendar.occurrences}
            timezone={calendar.timezone}
            showClassName
            emptyMessage={
              classes.length === 0 ? "You have no active classes yet." : "No sessions this week."
            }
            onChanged={load}
          />
        </>
      )}
    </div>
  );
}

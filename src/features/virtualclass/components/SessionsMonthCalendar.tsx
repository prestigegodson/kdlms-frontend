import { useRef } from "react";
import type { Occurrence } from "@/api/virtualClasses";
import { dateInZone, longDate, monthGrid, monthOf } from "../scheduleUtils";
import { SessionList } from "./SessionList";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface SessionsMonthCalendarProps {
  /** "YYYY-MM" being shown. */
  month: string;
  /** Every session in the month's grid, leading and trailing days included. */
  occurrences: Occurrence[];
  timezone: string;
  selectedDate: string;
  onSelectDate: (date: string) => void;
  onChanged: () => void;
}

/**
 * A Sunday-first month grid of the creator's sessions beside the selected day's sessions (stacked
 * below `md`). A day with a session that isn't cancelled is tinted, a day whose sessions are all
 * cancelled gets a muted dot, and today gets a dark dot. Days are in the creator's own timezone.
 */
export function SessionsMonthCalendar({
  month,
  occurrences,
  timezone,
  selectedDate,
  onSelectDate,
  onChanged,
}: SessionsMonthCalendarProps) {
  const dayPanel = useRef<HTMLElement>(null);
  const byDate = new Map<string, Occurrence[]>();
  for (const occurrence of occurrences) {
    const date = dateInZone(occurrence.scheduledStart, timezone);
    byDate.set(date, [...(byDate.get(date) ?? []), occurrence]);
  }
  const today = dateInZone(new Date(), timezone);
  const selectedSessions = byDate.get(selectedDate) ?? [];

  const select = (date: string) => {
    onSelectDate(date);
    // Stacked layout: bring the day's sessions into view below the grid.
    if (window.matchMedia?.("(max-width: 767px)").matches) {
      dayPanel.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="flex flex-col rounded-card border border-slate-200 bg-white shadow-sm md:flex-row">
      <div className="p-4 sm:p-6 md:w-[24rem] md:shrink-0 md:border-r md:border-slate-200">
        <div className="grid grid-cols-7 gap-1 text-center">
          {WEEKDAYS.map((day) => (
            <div
              key={day}
              aria-hidden="true"
              className="pb-2 text-xs font-medium uppercase tracking-wide text-slate-500"
            >
              {day}
            </div>
          ))}
          {monthGrid(month).map((date) => {
            const sessions = byDate.get(date) ?? [];
            const active = sessions.filter((s) => s.status !== "CANCELLED").length;
            const cancelledOnly = sessions.length > 0 && active === 0;
            const selected = date === selectedDate;
            const inMonth = monthOf(date) === month;
            const isToday = date === today;
            const count = sessions.length;
            const tone = selected
              ? "bg-brand-600 font-semibold text-white"
              : active > 0
                ? "bg-brand-50 font-semibold text-brand-700 hover:bg-brand-100"
                : `${inMonth ? "text-slate-700" : "text-slate-400"} hover:bg-slate-100`;
            const dot = isToday
              ? selected
                ? "bg-white"
                : "bg-slate-900"
              : cancelledOnly
                ? selected
                  ? "bg-white/70"
                  : "bg-slate-300"
                : null;
            return (
              <div key={date} className="flex justify-center">
                <button
                  type="button"
                  aria-pressed={selected}
                  aria-label={`${longDate(date)}${isToday ? ", today" : ""}, ${
                    count === 0 ? "no sessions" : `${count} session${count === 1 ? "" : "s"}`
                  }${cancelledOnly ? ", all cancelled" : ""}`}
                  data-marker={active > 0 ? "sessions" : cancelledOnly ? "cancelled" : "none"}
                  onClick={() => select(date)}
                  className={`relative flex aspect-square w-full max-w-12 min-w-10 cursor-pointer items-center justify-center rounded-full text-sm mobile:min-h-11 ${tone} ${
                    inMonth || selected ? "" : "opacity-60"
                  }`}
                >
                  {Number(date.slice(8))}
                  {dot && (
                    <span
                      aria-hidden="true"
                      data-testid={isToday ? "today-dot" : "cancelled-dot"}
                      className={`absolute bottom-1 h-1 w-1 rounded-full ${dot}`}
                    />
                  )}
                </button>
              </div>
            );
          })}
        </div>
        <p className="mt-4 text-xs text-slate-500">Times are in {timezone}.</p>
      </div>

      <section
        ref={dayPanel}
        aria-label={`Sessions on ${longDate(selectedDate)}`}
        className="min-w-0 flex-1 scroll-mt-20 border-t border-slate-200 p-4 sm:p-6 md:max-h-[36rem] md:overflow-y-auto md:overscroll-contain md:border-t-0"
      >
        <h2 className="mb-3 text-base font-semibold text-slate-900">{longDate(selectedDate)}</h2>
        <SessionList
          occurrences={selectedSessions}
          timezone={timezone}
          showClassName
          hideDateHeadings
          emptyMessage="No sessions on this day."
          onChanged={onChanged}
        />
      </section>
    </div>
  );
}

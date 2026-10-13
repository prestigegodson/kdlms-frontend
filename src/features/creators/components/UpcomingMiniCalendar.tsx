import { ChevronLeft, ChevronRight } from "lucide-react";
import { addMonths, longDate, monthGrid, monthLabel, monthOf } from "@/features/virtualclass/scheduleUtils";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

interface UpcomingMiniCalendarProps {
  /** "YYYY-MM" being shown. */
  month: string;
  /** The earliest and latest "YYYY-MM" the arrows may reach - the months the data covers. */
  minMonth: string;
  maxMonth: string;
  onMonthChange: (month: string) => void;
  /** Non-cancelled sessions per "YYYY-MM-DD". */
  counts: Map<string, number>;
  today: string;
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
}

/**
 * The creator dashboard's small month calendar: a dot under each day with sessions (two for
 * several), today filled, and a click on a session day filtering the list beside it. Paging is
 * bounded to the months the upcoming window actually covers, so it never shows months that can't
 * have dots.
 */
export function UpcomingMiniCalendar({
  month,
  minMonth,
  maxMonth,
  onMonthChange,
  counts,
  today,
  selectedDate,
  onSelectDate,
}: UpcomingMiniCalendarProps) {
  const navButton =
    "flex h-9 w-9 items-center justify-center rounded-full bg-slate-50 text-brand-600 hover:bg-brand-50 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-slate-50 mobile:h-11 mobile:w-11";

  return (
    <div>
      <div className="flex items-center justify-between">
        <button
          type="button"
          aria-label="Previous month"
          className={navButton}
          disabled={month <= minMonth}
          onClick={() => onMonthChange(addMonths(month, -1))}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </button>
        <h3 className="text-sm font-semibold text-slate-900">{monthLabel(month)}</h3>
        <button
          type="button"
          aria-label="Next month"
          className={navButton}
          disabled={month >= maxMonth}
          onClick={() => onMonthChange(addMonths(month, 1))}
        >
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-y-2.5 text-center">
        {WEEKDAYS.map((day, index) => (
          <div key={index} aria-hidden="true" className="pb-2 text-xs font-medium text-slate-500">
            {day}
          </div>
        ))}
        {monthGrid(month).map((date) => {
          const inMonth = monthOf(date) === month;
          if (!inMonth) return <div key={date} aria-hidden="true" />;
          const count = counts.get(date) ?? 0;
          const isToday = date === today;
          const selected = date === selectedDate;
          const tone = isToday
            ? "bg-brand-600 font-semibold text-white"
            : selected
              ? "bg-brand-50 font-semibold text-brand-700 ring-1 ring-brand-300"
              : count > 0
                ? "text-slate-900 hover:bg-slate-100"
                : "text-slate-500";
          return (
            <div key={date} className="flex justify-center">
              <button
                type="button"
                aria-pressed={selected}
                aria-disabled={count === 0}
                aria-label={`${longDate(date)}${isToday ? ", today" : ""}, ${
                  count === 0 ? "no sessions" : `${count} session${count === 1 ? "" : "s"}`
                }`}
                onClick={() => count > 0 && onSelectDate(date)}
                className={`relative flex h-9 w-9 items-center justify-center rounded-full text-sm mobile:h-11 mobile:w-11 ${tone} ${
                  count > 0 ? "cursor-pointer" : "cursor-default"
                }`}
              >
                {Number(date.slice(8))}
                {count > 0 && (
                  <span aria-hidden="true" className="absolute -bottom-1.5 flex gap-0.5" data-testid="session-dots">
                    {Array.from({ length: Math.min(count, 2) }, (_, i) => (
                      <span key={i} className="h-1 w-1 rounded-full bg-brand-500" />
                    ))}
                  </span>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

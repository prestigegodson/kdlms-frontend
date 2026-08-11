import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { useId, useState } from "react";
import { Badge } from "@/components/ui/Badge";

interface AttendanceMonthGroupProps {
  monthName: string;
  dayCount: number;
  /** Whether this month starts expanded - `AttendanceSummaryPanel` sets this on the most recent month only. */
  defaultOpen?: boolean;
  children: ReactNode;
}

/**
 * One month's day-by-day rows inside `AttendanceSummaryPanel`, collapsed by
 * default at every width - like `AttendanceLevelGroup`, and unlike
 * `components/ui/Accordion`, which only collapses below the `mobile`
 * breakpoint and is always expanded from `md` up. The body is only rendered
 * while open (not just hidden), so a test never sees a collapsed month's
 * rows without first opening it.
 */
export function AttendanceMonthGroup({ monthName, dayCount, defaultOpen = false, children }: AttendanceMonthGroupProps) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = useId();

  return (
    <div className="py-1">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 py-2 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
          {monthName}
        </span>
        <Badge variant="neutral">
          {dayCount} {dayCount === 1 ? "day" : "days"}
        </Badge>
      </button>
      {open && (
        <ul id={bodyId} className="max-h-64 space-y-1 overflow-y-auto overscroll-contain pl-6 text-sm">
          {children}
        </ul>
      )}
    </div>
  );
}

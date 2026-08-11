import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { useId, useState } from "react";
import { Badge } from "@/components/ui/Badge";

interface AttendanceLevelGroupProps {
  levelName: string;
  classesMarked: number;
  totalClasses: number;
  children: ReactNode;
}

/**
 * One level's classes inside AttendanceTodayCard, collapsed by default at
 * every width - unlike components/ui/Accordion, which only collapses below
 * the `mobile` breakpoint and is always expanded from `md` up. The body is
 * only rendered while open (not just hidden), so a test never sees a
 * collapsed level's rows without first opening it.
 */
export function AttendanceLevelGroup({
  levelName,
  classesMarked,
  totalClasses,
  children,
}: AttendanceLevelGroupProps) {
  const [open, setOpen] = useState(false);
  const bodyId = useId();
  const allMarked = totalClasses > 0 && classesMarked === totalClasses;

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
          {levelName}
        </span>
        <Badge variant={allMarked ? "success" : "neutral"}>
          {classesMarked} of {totalClasses} marked
        </Badge>
      </button>
      {open && (
        <ul id={bodyId} className="divide-y divide-slate-100 pl-6">
          {children}
        </ul>
      )}
    </div>
  );
}

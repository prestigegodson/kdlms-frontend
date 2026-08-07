import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface StatTileProps {
  label: string;
  value: ReactNode;
  icon?: LucideIcon;
  hint?: string;
}

/** A single labeled metric in a dashboard/summary grid (e.g. subscription usage, future portal dashboards). */
export function StatTile({ label, value, icon: Icon, hint }: StatTileProps) {
  return (
    <div className="min-w-0 rounded-card border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-xs font-semibold uppercase tracking-wide text-slate-500">
          {label}
        </p>
        {Icon && <Icon className="h-4 w-4 shrink-0 text-brand-400" aria-hidden="true" />}
      </div>
      <p className="mt-2 break-words font-display text-2xl font-medium tabular-nums text-slate-900">
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

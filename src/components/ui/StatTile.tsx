import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";

interface StatTileProps {
  label: string;
  value: ReactNode;
  icon?: LucideIcon;
  hint?: string;
  /**
   * Makes the whole tile a tap target routing there via react-router - the
   * `TableRow`/`to` opt-in's counterpart for a dashboard stat grid
   * (mobile-plan.md Phase D). Unset, it stays the plain non-interactive
   * `<div>` every other caller (SubscriptionPage, the system-admin
   * dashboard) already renders.
   */
  to?: string;
}

/** A single labeled metric in a dashboard/summary grid (e.g. subscription usage, future portal dashboards). */
export function StatTile({ label, value, icon: Icon, hint, to }: StatTileProps) {
  const content = (
    <>
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
    </>
  );

  if (to) {
    return (
      <Link
        to={to}
        className="block min-w-0 rounded-card border border-slate-200 bg-white p-5 transition-colors hover:border-brand-200 hover:bg-brand-50/40"
      >
        {content}
      </Link>
    );
  }

  return <div className="min-w-0 rounded-card border border-slate-200 bg-white p-5">{content}</div>;
}

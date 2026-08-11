import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { Card } from "@/components/ui/Card";

interface DrillRowProps {
  /** Required unless `disabled` - a disabled row renders no link. */
  to?: string;
  title: ReactNode;
  meta?: ReactNode;
  trailing?: ReactNode;
  /** Renders as an inert row instead of a link - e.g. a session/term with nothing published yet. */
  disabled?: boolean;
  /** Shown in place of `meta` while disabled, e.g. "No published results yet". */
  disabledReason?: string;
}

/**
 * One tappable step in the guardian results drill-down (ward/session/term
 * list) - the `features/guardian/results` counterpart to
 * `components/ui/Table`'s `TableRow`/`StatTile`'s `to=` opt-in, for a list
 * that isn't tabular. Enabled rows are a real `Link` (`cursor-pointer`,
 * global `:active` dim from index.css's `@layer base`); disabled rows are a
 * plain, non-interactive `div` with `aria-disabled` and no chevron.
 */
export function DrillRow({ to, title, meta, trailing, disabled = false, disabledReason }: DrillRowProps) {
  const content = (
    <div className="flex items-center gap-3">
      <div className="min-w-0 flex-1">
        <p className={`font-display text-base font-medium ${disabled ? "text-slate-400" : "text-slate-900"}`}>
          {title}
        </p>
        {disabled
          ? disabledReason && <p className="mt-0.5 text-sm text-slate-400">{disabledReason}</p>
          : meta && <p className="mt-0.5 text-sm text-slate-500">{meta}</p>}
      </div>
      {trailing && !disabled && <div className="shrink-0">{trailing}</div>}
      {!disabled && <ChevronRight className="h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />}
    </div>
  );

  if (disabled) {
    return (
      <Card aria-disabled="true" className="cursor-not-allowed p-4 opacity-70">
        {content}
      </Card>
    );
  }

  return (
    <Link to={to ?? ""} className="block">
      <Card className="cursor-pointer p-4 transition-colors hover:border-brand-200 hover:bg-brand-50/40">
        {content}
      </Card>
    </Link>
  );
}

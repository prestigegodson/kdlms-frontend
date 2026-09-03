import type { ResultScope } from "@/api/types";
import { useFilterChip } from "@/components/ui/StickySubHeader";

interface ScopeToggleProps {
  scope: ResultScope;
  onChange: (scope: ResultScope) => void;
}

const OPTIONS: Array<{ value: ResultScope; label: string }> = [
  { value: "MIDTERM", label: "Mid-term" },
  { value: "TERM", label: "End of term" },
];

/**
 * A Mid-term / End of term segmented control (mirrors StatusSegments'
 * radiogroup markup) - the one control that switches every scope-aware view
 * (results panel, broadsheet, report preview/PDF, guardian ward results)
 * between the two independently-recorded, independently-published results
 * for a term (see CLAUDE.md's ResultScope domain rule). Publishes its own
 * filter chip unconditionally and never null, since a `collapsible`
 * StickySubHeader keeps its panel open while any chip is unset - a no-op
 * outside a collapsible header, so a plain StickySubHeader (ReportsPage,
 * StudentResultHistoryPage) can drop this in unchanged.
 */
export function ScopeToggle({ scope, onChange }: ScopeToggleProps) {
  useFilterChip("scope", scope === "MIDTERM" ? "Mid-term" : "End of term");

  return (
    <div role="radiogroup" aria-label="Result scope" className="inline-flex rounded-control border border-slate-200 bg-white p-1">
      {OPTIONS.map((option) => {
        const selected = scope === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={`cursor-pointer rounded-control px-3 py-1.5 text-sm font-medium mobile:min-h-11 ${
              selected ? "bg-brand-50 text-brand-800" : "text-slate-600 hover:text-slate-800"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

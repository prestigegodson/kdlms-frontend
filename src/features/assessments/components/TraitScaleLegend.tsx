import type { TraitCategorySheet } from "@/api/assessments";

interface TraitScaleLegendProps {
  category: TraitCategorySheet;
}

/**
 * The rating-scale chip row shown above a trait tab's grid, e.g.
 * "1 VERY POOR · 5 EXCELLENT" - lets a teacher read what each value means
 * without opening every Select. Mirrors `TraitKey`'s chip markup, but reads
 * from the entry sheet's own `TraitCategorySheet.scaleOptions` (no `rank`
 * field - the server already emits them in scale order, so this renders
 * them as-is rather than re-sorting).
 */
export function TraitScaleLegend({ category }: TraitScaleLegendProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {category.scaleOptions.map((option) => (
        <span key={option.id} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-700">
          <strong className="text-slate-900">{option.value}</strong>
          {option.label}
        </span>
      ))}
    </div>
  );
}

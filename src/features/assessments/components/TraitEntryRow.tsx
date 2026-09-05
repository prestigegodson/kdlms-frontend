import type { RemarkSheetRow, TraitCategorySheet } from "@/api/assessments";
import { Select } from "@/components/ui/Select";
import { TableCell, TableRow } from "@/components/ui/Table";
import type { TraitDraft } from "@/features/assessments/components/RemarksEntryGrid";

interface TraitEntryRowProps {
  row: RemarkSheetRow;
  category: TraitCategorySheet;
  editable: boolean;
  dirty: boolean;
  traitDraft: TraitDraft;
  onTraitChange: (traitId: string, scaleOptionId: string) => void;
}

/**
 * One student's behavioural-trait ratings for a single category (AFFECTIVE
 * or PSYCHOMOTOR) - its own tab in `RemarksEntryGrid`, split out of
 * `RemarkEntryRow` so a rating (chosen from a scale) reads as a different
 * kind of entry from the holistic remark's free text. One `Select` per
 * active trait of this category, each its own `TableCell` so
 * `.responsive-table`'s stacked-card mode still renders a labelled control
 * per trait on mobile.
 */
export function TraitEntryRow({ row, category, editable, dirty, traitDraft, onTraitChange }: TraitEntryRowProps) {
  return (
    <TableRow className={dirty ? "border-l-2 border-l-brand-500" : ""}>
      <TableCell label="Student">
        <span className="font-medium text-slate-900">{row.studentName}</span>
        <span className="block text-xs text-slate-500">{row.admissionNumber}</span>
      </TableCell>
      {category.traits.map((trait) => {
        const scaleOptionId = traitDraft[trait.id] ?? "";
        const selectedOption = category.scaleOptions.find((option) => option.id === scaleOptionId);
        return (
          <TableCell key={trait.id} label={trait.name}>
            {editable ? (
              <Select
                aria-label={`${trait.name} for ${row.studentName}`}
                value={scaleOptionId}
                onChange={(event) => onTraitChange(trait.id, event.target.value)}
              >
                <option value="">Select a rating…</option>
                {category.scaleOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.value} - {option.label}
                  </option>
                ))}
              </Select>
            ) : (
              <span className="text-slate-500">{selectedOption ? `${selectedOption.value} - ${selectedOption.label}` : "—"}</span>
            )}
          </TableCell>
        );
      })}
    </TableRow>
  );
}

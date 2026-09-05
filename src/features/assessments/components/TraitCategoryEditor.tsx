import { Checkbox } from "@/components/ui/Checkbox";
import { type TraitDefinitionRow, TraitDefinitionRows } from "@/features/assessments/components/TraitDefinitionRows";
import { type TraitScaleRow, TraitScaleRows } from "@/features/assessments/components/TraitScaleRows";

interface TraitCategoryEditorProps {
  title: string;
  description: string;
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  scaleOptions: TraitScaleRow[];
  onScaleOptionsChange: (options: TraitScaleRow[]) => void;
  traits: TraitDefinitionRow[];
  onTraitsChange: (traits: TraitDefinitionRow[]) => void;
}

/**
 * One behavioural-trait category's config block (affective disposition or
 * psychomotor skills) - an enable toggle plus, once enabled, its trait list
 * and rating scale. Mode-agnostic: unlike the NUMERIC/QUALITATIVE cards
 * above it on `GradingSystemEditorPage`, this renders the same way
 * regardless of the level's assessment mode.
 */
export function TraitCategoryEditor({
  title,
  description,
  enabled,
  onEnabledChange,
  scaleOptions,
  onScaleOptionsChange,
  traits,
  onTraitsChange,
}: TraitCategoryEditorProps) {
  return (
    <div className="space-y-4">
      <div>
        <label className="flex items-center gap-2 text-sm font-medium text-slate-900">
          <Checkbox checked={enabled} onChange={(event) => onEnabledChange(event.target.checked)} />
          {title}
        </label>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>

      {enabled && (
        <div className="space-y-4 border-t border-slate-100 pt-4">
          <TraitDefinitionRows traits={traits} onChange={onTraitsChange} />
          <TraitScaleRows options={scaleOptions} onChange={onScaleOptionsChange} />
        </div>
      )}
    </div>
  );
}

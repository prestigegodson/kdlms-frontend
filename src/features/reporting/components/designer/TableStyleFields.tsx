import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { ColorField } from "@/features/reporting/components/designer/ColorField";
import {
  CELL_PADDINGS,
  type CellPadding,
  DEFAULT_TABLE_STYLE,
  type TableStyle,
  compactStyle,
} from "@/features/reporting/components/designer/layout";

const CELL_PADDING_LABELS: Record<CellPadding, string> = {
  COMPACT: "Compact",
  NORMAL: "Normal",
  ROOMY: "Roomy",
};

interface TableStyleFieldsProps {
  idPrefix: string;
  /** The style set at this level - each unset field falls back to `inherited`. */
  value: TableStyle | undefined;
  /** What applies where `value` leaves a field unset: the page default for a block, `undefined` for the page itself. */
  inherited: TableStyle | undefined;
  onChange: (next: TableStyle | undefined) => void;
  clearLabel?: string;
}

function numberOrUndefined(value: string): number | undefined {
  if (value === "") return undefined;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

/** Border, padding, text size, stripes and label-column shade for a block table - see `TableStyle`. */
export function TableStyleFields({ idPrefix, value, inherited, onChange, clearLabel }: TableStyleFieldsProps) {
  function set(patch: Partial<TableStyle>) {
    onChange(compactStyle<TableStyle>({ ...value, ...patch }));
  }

  const borderWidthFallback = inherited?.borderWidthPx ?? DEFAULT_TABLE_STYLE.borderWidthPx;
  const fontSizeFallback = inherited?.fontSizePx ?? DEFAULT_TABLE_STYLE.fontSizePx;
  const paddingFallback = inherited?.cellPadding ?? DEFAULT_TABLE_STYLE.cellPadding;

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <ColorField
          id={`${idPrefix}-border-color`}
          label="Border color"
          value={value?.borderColor}
          fallback={inherited?.borderColor ?? DEFAULT_TABLE_STYLE.borderColor}
          onChange={(borderColor) => set({ borderColor })}
          clearLabel={clearLabel}
        />
        <FormField label="Border width (px)" htmlFor={`${idPrefix}-border-width`}>
          <Input
            id={`${idPrefix}-border-width`}
            type="number"
            min={0}
            max={4}
            placeholder={String(borderWidthFallback)}
            value={value?.borderWidthPx ?? ""}
            onChange={(e) => set({ borderWidthPx: numberOrUndefined(e.target.value) })}
          />
        </FormField>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <FormField label="Cell spacing" htmlFor={`${idPrefix}-padding`}>
          <Select
            id={`${idPrefix}-padding`}
            value={value?.cellPadding ?? ""}
            onChange={(e) => set({ cellPadding: (e.target.value || undefined) as CellPadding | undefined })}
          >
            <option value="">{`Default (${CELL_PADDING_LABELS[paddingFallback]})`}</option>
            {CELL_PADDINGS.map((padding) => (
              <option key={padding} value={padding}>
                {CELL_PADDING_LABELS[padding]}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Text size (px)" htmlFor={`${idPrefix}-font-size`}>
          <Input
            id={`${idPrefix}-font-size`}
            type="number"
            min={8}
            max={16}
            placeholder={String(fontSizeFallback)}
            value={value?.fontSizePx ?? ""}
            onChange={(e) => set({ fontSizePx: numberOrUndefined(e.target.value) })}
          />
        </FormField>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <ColorField
          id={`${idPrefix}-stripe`}
          label="Alternate row shade"
          value={value?.stripeColor}
          fallback={inherited?.stripeColor ?? "#ffffff"}
          onChange={(stripeColor) => set({ stripeColor })}
          clearLabel={clearLabel ?? "No shade"}
        />
        <ColorField
          id={`${idPrefix}-label-bg`}
          label="First column shade"
          value={value?.labelBackground}
          fallback={inherited?.labelBackground ?? "#ffffff"}
          onChange={(labelBackground) => set({ labelBackground })}
          clearLabel={clearLabel ?? "No shade"}
        />
      </div>
    </div>
  );
}

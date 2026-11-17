import { Checkbox } from "@/components/ui/Checkbox";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { ColorField } from "@/features/reporting/components/designer/ColorField";
import {
  type HeadingStyle,
  type ReportBlockName,
  compactStyle,
} from "@/features/reporting/components/designer/layout";

/** Each heading block's platform default - mirrors backend `TemplateRenderer`'s `SCHOOL_NAME_SIZE_PX`/`REMARK_LABEL_*`. */
const HEADING_DEFAULTS: Partial<Record<ReportBlockName, { sizePx: number; color?: string; label: string }>> = {
  SCHOOL_HEADER: { sizePx: 20, label: "School name" },
  REMARK_CLASS_TEACHER: { sizePx: 10, color: "#555555", label: "Remark label" },
  REMARK_PRINCIPAL: { sizePx: 10, color: "#555555", label: "Remark label" },
};

function numberOrUndefined(value: string): number | undefined {
  if (value === "") return undefined;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

interface HeadingFieldsProps {
  block: ReportBlockName;
  value: HeadingStyle | undefined;
  /** Text colour the heading inherits when neither it nor the block default sets one. */
  inheritedColor: string;
  onChange: (next: HeadingStyle | undefined) => void;
}

/** Size, colour, capitals and letter spacing of a block's headline - see `HeadingStyle`. */
export function HeadingFields({ block, value, inheritedColor, onChange }: HeadingFieldsProps) {
  const defaults = HEADING_DEFAULTS[block];
  if (!defaults) return null;

  function set(patch: Partial<HeadingStyle>) {
    onChange(compactStyle<HeadingStyle>({ ...value, ...patch }));
  }

  return (
    <div className="space-y-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{defaults.label}</span>
      <div className="grid grid-cols-2 gap-2">
        <FormField label="Size (px)" htmlFor="heading-size">
          <Input
            id="heading-size"
            type="number"
            min={8}
            max={48}
            placeholder={String(defaults.sizePx)}
            value={value?.fontSizePx ?? ""}
            onChange={(e) => set({ fontSizePx: numberOrUndefined(e.target.value) })}
          />
        </FormField>
        <ColorField
          id="heading-color"
          label="Color"
          value={value?.color}
          fallback={defaults.color ?? inheritedColor}
          onChange={(color) => set({ color })}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <FormField label="Letter spacing (px)" htmlFor="heading-spacing">
          <Input
            id="heading-spacing"
            type="number"
            min={0}
            max={10}
            placeholder="0"
            value={value?.letterSpacingPx ?? ""}
            onChange={(e) => set({ letterSpacingPx: numberOrUndefined(e.target.value) })}
          />
        </FormField>
        {block === "SCHOOL_HEADER" && (
          <ColorField
            id="heading-sub-color"
            label="Address color"
            value={value?.subColor}
            fallback={inheritedColor}
            onChange={(subColor) => set({ subColor })}
          />
        )}
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <Checkbox checked={value?.uppercase ?? false} onChange={(e) => set({ uppercase: e.target.checked })} />
        All capitals
      </label>
    </div>
  );
}

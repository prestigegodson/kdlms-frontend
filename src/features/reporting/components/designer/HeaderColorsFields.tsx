import { ColorField } from "@/features/reporting/components/designer/ColorField";
import { type HeaderColors, compactHeaderColors } from "@/features/reporting/components/designer/layout";

interface HeaderColorsFieldsProps {
  idPrefix: string;
  /** The colours set at this level - each unset field falls back to `inherited`. */
  value: HeaderColors | undefined;
  /** Fully resolved colours that apply where `value` leaves a field unset. */
  inherited: Required<HeaderColors>;
  onChange: (next: HeaderColors | undefined) => void;
  /** Label for the second header level, e.g. "Subject group row" or "Title row"; omitted when the table has none. */
  bandLabel?: string;
  clearLabel?: string;
}

/** Background/text pickers for a table's main header row and, optionally, its band row - see `HeaderColors`. */
export function HeaderColorsFields({ idPrefix, value, inherited, onChange, bandLabel, clearLabel }: HeaderColorsFieldsProps) {
  function set(key: keyof HeaderColors, color: string | undefined) {
    onChange(compactHeaderColors({ ...value, [key]: color }));
  }

  function field(key: keyof HeaderColors, label: string) {
    return (
      <ColorField
        id={`${idPrefix}-${key}`}
        label={label}
        value={value?.[key]}
        fallback={inherited[key]}
        onChange={(color) => set(key, color)}
        clearLabel={clearLabel}
      />
    );
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        {field("headerBackground", "Header background")}
        {field("headerText", "Header text")}
      </div>
      {bandLabel && (
        <div className="grid grid-cols-2 gap-2">
          {field("bandBackground", `${bandLabel} background`)}
          {field("bandText", `${bandLabel} text`)}
        </div>
      )}
    </div>
  );
}

import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";

interface ColorFieldProps {
  id: string;
  label: string;
  /** The stored value - `undefined` means unset, and the picker shows `fallback` instead. */
  value: string | undefined;
  /** What actually applies while `value` is unset (a default or an inherited colour). */
  fallback: string;
  onChange: (value: string | undefined) => void;
  /** Label for the reset button, shown only while a value is set. */
  clearLabel?: string;
}

/** A colour picker plus a reset button - the inspector's one shape for an optional colour. */
export function ColorField({ id, label, value, fallback, onChange, clearLabel = "Reset to default" }: ColorFieldProps) {
  return (
    <FormField label={label} htmlFor={id}>
      {/* Stacked, not side by side: header colours sit two to a 280px inspector row, too narrow for swatch + button. */}
      <div className="flex flex-col items-start gap-1">
        <Input
          id={id}
          type="color"
          className="h-9 cursor-pointer p-1"
          value={value ?? fallback}
          onChange={(e) => onChange(e.target.value)}
        />
        {value && (
          <button type="button" className="text-xs text-brand-600 hover:text-brand-700" onClick={() => onChange(undefined)}>
            {clearLabel}
          </button>
        )}
      </div>
    </FormField>
  );
}

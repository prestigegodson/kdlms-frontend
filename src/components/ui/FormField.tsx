import type { ReactNode } from "react";

interface FormFieldProps {
  label: string;
  htmlFor?: string;
  error?: string;
  children: ReactNode;
  className?: string;
  /**
   * Extra classes appended to the `<label>` - e.g. `"sr-only lg:not-sr-only"` to keep the
   * accessible `<label for>` association while visually hiding the label below `lg`, the same
   * idiom `PageHeader`'s `<h1>` uses for the mobile app bar. Optional; the label renders normally
   * when omitted.
   */
  labelClassName?: string;
  /**
   * What to enter in this field - guidance for a blank form, not a validation message. Renders
   * between the label and the control (a form is filled top-to-bottom, so this must be read
   * before the input, unlike `error`, which reports on a value already entered and so stays
   * below it). Rendered with `id="{htmlFor}-description"` when `htmlFor` is set, so a call site
   * can wire `aria-describedby` on its control; omitted when there's no single control to
   * describe (e.g. `StringListField`'s repeatable rows).
   */
  description?: ReactNode;
}

/** Label + description + control + error message, matching how every backend validation error should surface next to its field. */
export function FormField({
  label,
  htmlFor,
  error,
  children,
  className = "",
  labelClassName = "",
  description,
}: FormFieldProps) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className={`block text-sm font-medium text-slate-700 ${labelClassName}`}>
        {label}
      </label>
      {description && (
        <p id={htmlFor ? `${htmlFor}-description` : undefined} className="mt-0.5 text-xs text-slate-500">
          {description}
        </p>
      )}
      <div className="mt-1">{children}</div>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}

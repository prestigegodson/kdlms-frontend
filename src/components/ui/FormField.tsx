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
}

/** Label + control + error message, matching how every backend validation error should surface next to its field. */
export function FormField({
  label,
  htmlFor,
  error,
  children,
  className = "",
  labelClassName = "",
}: FormFieldProps) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className={`block text-sm font-medium text-slate-700 ${labelClassName}`}>
        {label}
      </label>
      <div className="mt-1">{children}</div>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}

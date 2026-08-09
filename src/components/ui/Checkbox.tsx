import type { InputHTMLAttributes } from "react";

/**
 * The 16px visual box stays the app's standard checkbox size at every
 * width; below `md` it's wrapped in an invisible `p-2.5 -m-2.5` hit area
 * (padding pushing the tappable region out, an equal negative margin
 * pulling the box's own layout footprint back to its visual size) so it's
 * comfortably tappable without growing on screen - matters most for the
 * attendance register and the compose-note student picker, where rows are
 * already densely stacked.
 */
export function Checkbox({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <span className="mobile:-m-2.5 mobile:inline-flex mobile:items-center mobile:justify-center mobile:p-2.5">
      <input
        type="checkbox"
        className={`h-4 w-4 rounded border-slate-300 text-brand-500 ${className}`}
        {...props}
      />
    </span>
  );
}

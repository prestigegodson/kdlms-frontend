import type { ButtonHTMLAttributes } from "react";
import { Spinner } from "@/components/ui/Spinner";

type Variant = "primary" | "secondary" | "ghost" | "accent" | "danger" | "destructive";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** Shows an inline spinner and disables the button without swapping its label, so its width stays stable while a submit is in flight. */
  loading?: boolean;
}

/*
 * Per style_guide.md §3: primary (brand fill) for default actions, accent
 * (amber fill) for the one key CTA on a view, secondary/ghost for
 * lower-emphasis actions, danger for destructive ones. "destructive" is an
 * alias of "danger" - the guide's term - kept so existing callers of
 * "danger" don't need to change.
 */
const VARIANT_CLASSES: Record<Variant, string> = {
  primary: "bg-brand-500 text-white hover:bg-brand-600",
  secondary: "bg-white text-slate-900 border border-slate-300 hover:bg-slate-50",
  ghost: "text-slate-600 hover:bg-slate-100",
  accent: "bg-accent-500 text-[#311F02] hover:bg-accent-600",
  danger: "bg-red-600 text-white hover:bg-red-700",
  destructive: "bg-red-600 text-white hover:bg-red-700",
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: "gap-1.5 px-3 py-1.5 text-sm",
  md: "gap-2 px-4 py-2 text-sm",
  lg: "gap-2 px-5 py-2.5 text-base",
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  className = "",
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex items-center justify-center rounded-control font-medium
        transition-colors disabled:pointer-events-none disabled:opacity-50
        ${SIZE_CLASSES[size]} ${VARIANT_CLASSES[variant]} ${className}`}
      {...props}
    >
      {loading && <Spinner className="text-current" />}
      {children}
    </button>
  );
}

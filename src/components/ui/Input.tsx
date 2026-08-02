import type { InputHTMLAttributes, Ref } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  // React 19 accepts `ref` as a plain prop on function components - no forwardRef needed.
  // Optional and unused by most callers; DateInput reads it to move focus back after closing its popup.
  ref?: Ref<HTMLInputElement>;
}

export function Input({ className = "", ref, ...props }: InputProps) {
  return (
    <input
      ref={ref}
      className={`block w-full rounded-control border border-slate-300 px-3 py-2 text-sm text-slate-900
        placeholder:text-slate-400 transition-colors focus:border-brand-500
        disabled:bg-slate-100 disabled:text-slate-500
        aria-[invalid=true]:border-red-400 ${className}`}
      {...props}
    />
  );
}

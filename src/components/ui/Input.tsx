import type { InputHTMLAttributes } from "react";

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`block w-full rounded-control border border-slate-300 px-3 py-2 text-sm text-slate-900
        placeholder:text-slate-400 transition-colors focus:border-brand-500
        disabled:bg-slate-100 disabled:text-slate-500
        aria-[invalid=true]:border-red-400 ${className}`}
      {...props}
    />
  );
}

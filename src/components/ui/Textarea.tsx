import type { TextareaHTMLAttributes } from "react";

export function Textarea({ className = "", ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={`block w-full rounded-control border border-slate-300 px-3 py-2 text-sm text-slate-900
        placeholder:text-slate-400 transition-colors focus:border-brand-500
        disabled:bg-slate-100 disabled:text-slate-500
        aria-[invalid=true]:border-red-400 mobile:text-base mobile:min-h-11 ${className}`}
      {...props}
    />
  );
}

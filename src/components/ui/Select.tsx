import { ChevronDown } from "lucide-react";
import type { SelectHTMLAttributes } from "react";

export function Select({ className = "", ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select
        className={`block w-full appearance-none rounded-control border border-slate-300 bg-white px-3 py-2 pr-9 text-sm text-slate-900
          transition-colors focus:border-brand-500
          disabled:bg-slate-100 disabled:text-slate-500 mobile:text-base mobile:min-h-11 ${className}`}
        {...props}
      />
      <ChevronDown
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
        aria-hidden="true"
      />
    </div>
  );
}

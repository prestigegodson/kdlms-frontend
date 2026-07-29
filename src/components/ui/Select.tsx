import type { SelectHTMLAttributes } from "react";

export function Select({ className = "", ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900
        focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500
        disabled:bg-gray-100 disabled:text-gray-500 ${className}`}
      {...props}
    />
  );
}

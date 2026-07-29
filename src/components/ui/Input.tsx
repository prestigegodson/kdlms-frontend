import type { InputHTMLAttributes } from "react";

export function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900
        placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500
        disabled:bg-gray-100 disabled:text-gray-500 ${className}`}
      {...props}
    />
  );
}

import type { HTMLAttributes } from "react";

export function Card({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-card border border-slate-200 bg-white p-4 shadow-sm sm:p-6 ${className}`}
      {...props}
    />
  );
}

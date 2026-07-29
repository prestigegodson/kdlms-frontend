import type { ReactNode } from "react";

type Variant = "info" | "success" | "error";

const VARIANT_CLASSES: Record<Variant, string> = {
  info: "bg-blue-50 text-blue-800 border-blue-200",
  success: "bg-green-50 text-green-800 border-green-200",
  error: "bg-red-50 text-red-800 border-red-200",
};

interface AlertProps {
  variant?: Variant;
  children: ReactNode;
  className?: string;
}

export function Alert({ variant = "info", children, className = "" }: AlertProps) {
  return (
    <div
      role="alert"
      className={`rounded-md border px-4 py-3 text-sm ${VARIANT_CLASSES[variant]} ${className}`}
    >
      {children}
    </div>
  );
}

import { GraduationCap } from "lucide-react";
import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";

interface AuthLayoutProps {
  title: string;
  description?: string;
  children: ReactNode;
}

/**
 * Shared chrome for the auth screens outside any portal - the three public
 * ones (sign in, forgot/reset password) plus SetInitialPasswordPage, which
 * is authenticated but deliberately chromeless (no PortalShell nav) since
 * it's a forced stop before the user reaches a portal at all. The faint
 * ruled ground echoes the register grammar used by tables throughout the
 * app (see components/ui/Table.tsx), at zero image weight.
 */
export function AuthLayout({ title, description, children }: AuthLayoutProps) {
  return (
    <div
      className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12"
      style={{
        backgroundImage:
          "repeating-linear-gradient(to bottom, transparent, transparent 39px, #E2E8F0 39px, #E2E8F0 40px)",
      }}
    >
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-card bg-brand-500 text-white">
            <GraduationCap className="h-6 w-6" aria-hidden="true" />
          </span>
          <span className="font-display text-xl font-medium text-brand-800">KDLMS</span>
        </div>
        <Card>
          <h1 className="font-display text-lg font-medium text-slate-900">{title}</h1>
          {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
          {children}
        </Card>
      </div>
    </div>
  );
}

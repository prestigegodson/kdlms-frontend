import { GraduationCap } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { Card } from "@/components/ui/Card";
import { usePublicBrandingStore } from "@/stores/publicBrandingStore";

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
 *
 * Phase 13: on a school's branded subdomain (`utils/host.ts`'s
 * `resolveSchoolSubdomain`), the logo mark and wordmark below swap for the
 * school's own - mirroring `layouts/PortalShell.tsx`'s `BrandMark` exactly,
 * so a guardian or staff member sees the same brand pre- and post-login. On
 * the platform's own host (or while branding is still loading/unset) the
 * KDLMS mark shows exactly as before.
 */
export function AuthLayout({ title, description, children }: AuthLayoutProps) {
  const fetchIfNeeded = usePublicBrandingStore((state) => state.fetchIfNeeded);
  const schoolName = usePublicBrandingStore((state) => state.schoolName);
  const logoDataUri = usePublicBrandingStore((state) => state.logoDataUri);

  useEffect(() => {
    fetchIfNeeded();
  }, [fetchIfNeeded]);

  return (
    <div
      className="flex min-h-dvh justify-center bg-slate-50 px-4 py-8 sm:py-12"
      style={{
        backgroundImage:
          "repeating-linear-gradient(to bottom, transparent, transparent 39px, #E2E8F0 39px, #E2E8F0 40px)",
      }}
    >
      <div className="my-auto w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          {logoDataUri ? (
            <img src={logoDataUri} alt={schoolName ?? "School logo"} className="max-h-14 w-auto max-w-full object-contain" />
          ) : (
            <>
              <span className="flex h-11 w-11 items-center justify-center rounded-card bg-brand-500 text-white">
                <GraduationCap className="h-6 w-6" aria-hidden="true" />
              </span>
              <span className="font-display text-xl font-medium text-brand-800">{schoolName ?? "KDLMS"}</span>
            </>
          )}
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

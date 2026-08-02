import { lazy, Suspense } from "react";
import { Spinner } from "@/components/ui/Spinner";

// The template designer is a large, admin-only component tree (palette,
// canvas, inspector) - lazy-loaded so its bundle only downloads for a
// SYSTEM_ADMIN who actually opens it, not on every page load. Kept in its
// own file (rather than inline in routes/index.tsx) since that file also
// exports the non-component `routes`/`router` values, which Fast Refresh
// can't mix with a component definition.
const TemplateDesignerPage = lazy(() => import("@/features/reporting/TemplateDesignerPage"));

export function TemplateDesignerRoute() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading designer…
        </div>
      }
    >
      <TemplateDesignerPage />
    </Suspense>
  );
}

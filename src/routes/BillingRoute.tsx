import { lazy, Suspense } from "react";
import { Spinner } from "@/components/ui/Spinner";

// BillingPage is a large, admin-only, multi-tab component tree (fee
// catalogue, settings, and - from later phases - prices/bills) - lazy-loaded
// so its bundle only downloads for someone who actually opens it, the
// LessonNoteEditorRoute/TemplateDesignerRoute precedent. Kept in its own
// file for the same reason: routes/index.tsx also exports the
// non-component routes/router values, which Fast Refresh can't mix with a
// component definition.
const BillingPage = lazy(() =>
  import("@/features/billing/BillingPage").then((module) => ({ default: module.BillingPage })),
);

export function BillingRoute() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading billing…
        </div>
      }
    >
      <BillingPage />
    </Suspense>
  );
}

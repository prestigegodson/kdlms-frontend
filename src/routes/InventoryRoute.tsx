import { lazy, Suspense } from "react";
import { Spinner } from "@/components/ui/Spinner";

// InventoryPage is a large, multi-tab component tree (catalogue, stock,
// requisitions) - lazy-loaded so its bundle only downloads for someone who
// actually opens it, the BillingRoute precedent. Kept in its own file for
// the same reason: routes/index.tsx also exports the non-component
// routes/router values, which Fast Refresh can't mix with a component
// definition.
const InventoryPage = lazy(() =>
  import("@/features/inventory/InventoryPage").then((module) => ({ default: module.InventoryPage })),
);

export function InventoryRoute() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading inventory…
        </div>
      }
    >
      <InventoryPage />
    </Suspense>
  );
}

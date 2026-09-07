import { lazy, Suspense } from "react";
import { Spinner } from "@/components/ui/Spinner";

// Lazy-loaded the same way `TakeHomeQuizEditorRoute` is, for the same
// reason: kept in its own file so `routes/index.tsx` can keep exporting only
// non-component `routes`/`router` values.
const TakeHomeQuizResultsPage = lazy(() =>
  import("@/features/takeHomeQuizzes/TakeHomeQuizResultsPage").then((module) => ({
    default: module.TakeHomeQuizResultsPage,
  })),
);

export function TakeHomeQuizResultsRoute() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading results…
        </div>
      }
    >
      <TakeHomeQuizResultsPage />
    </Suspense>
  );
}

import { lazy, Suspense } from "react";
import { Spinner } from "@/components/ui/Spinner";

const TakeHomeQuizPublicPage = lazy(() =>
  import("@/features/takeHomeQuizzes/public/TakeHomeQuizPublicPage").then((module) => ({
    default: module.TakeHomeQuizPublicPage,
  })),
);

/**
 * The unauthenticated take-home quiz page (Phase 20D) - a public sibling of
 * `login`/`reset-password` in `routes/index.tsx`, outside every
 * `RequireRole`. Lazy-loaded the same way `TakeHomeQuizEditorRoute` is: a
 * large, single-purpose page tree that shouldn't ship to every visitor.
 */
export function TakeHomeQuizRoute() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading quiz…
        </div>
      }
    >
      <TakeHomeQuizPublicPage />
    </Suspense>
  );
}

import { lazy, Suspense } from "react";
import { Spinner } from "@/components/ui/Spinner";

const LiveSessionPage = lazy(() =>
  import("@/features/virtualclass/pages/LiveSessionPage").then((module) => ({
    default: module.LiveSessionPage,
  })),
);

/**
 * A virtual class's live room (creators.md Phase C6) - full screen, outside every portal layout,
 * and lazy-loaded so LiveKit's client and styles ship only to someone actually joining a session.
 */
export function LiveSessionRoute() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading session…
        </div>
      }
    >
      <LiveSessionPage />
    </Suspense>
  );
}

import { lazy, Suspense } from "react";
import { Spinner } from "@/components/ui/Spinner";

const GuestQuizPage = lazy(() =>
  import("@/features/takeHomeQuizzes/public/GuestQuizPage").then((module) => ({
    default: module.GuestQuizPage,
  })),
);

/** The public page a tutor's guest link opens - outside every `RequireRole`, lazy-loaded like `TakeHomeQuizRoute`. */
export function GuestQuizRoute() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading quiz…
        </div>
      }
    >
      <GuestQuizPage />
    </Suspense>
  );
}

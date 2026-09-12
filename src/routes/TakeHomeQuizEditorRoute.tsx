import { lazy, Suspense } from "react";
import { Spinner } from "@/components/ui/Spinner";

// Lazy-loaded the same way `LessonNoteEditorRoute` is - kept in its own file
// so `routes/index.tsx` can keep exporting the non-component `routes`/
// `router` values, which Fast Refresh can't mix with a component
// definition. The question/option builder pulls in `RichTextField` (TipTap +
// KaTeX) via `QuestionEditor`/`ChoiceOptionsField`, the largest dependency
// this feature carries, so it stays lazy from the start rather than migrated
// later.
const TakeHomeQuizEditorPage = lazy(() =>
  import("@/features/takeHomeQuizzes/TakeHomeQuizEditorPage").then((module) => ({
    default: module.TakeHomeQuizEditorPage,
  })),
);

export function TakeHomeQuizEditorRoute() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading quiz…
        </div>
      }
    >
      <TakeHomeQuizEditorPage />
    </Suspense>
  );
}

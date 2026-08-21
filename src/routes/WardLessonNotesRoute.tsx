import { lazy, Suspense } from "react";
import { Spinner } from "@/components/ui/Spinner";

// Same rationale as `LessonNoteEditorRoute`: this page renders
// `LessonNoteReadView` for a ward's approved notes, which pulls in KaTeX
// (~270KB) via `MathText` - lazy-loaded so that cost is only paid by a
// guardian who opens this tab.
const WardLessonNotesPage = lazy(() =>
  import("@/features/guardian/WardLessonNotesPage").then((module) => ({
    default: module.WardLessonNotesPage,
  })),
);

export function WardLessonNotesRoute() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading lesson notes…
        </div>
      }
    >
      <WardLessonNotesPage />
    </Suspense>
  );
}

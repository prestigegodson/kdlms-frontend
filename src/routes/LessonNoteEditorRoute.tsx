import { lazy, Suspense } from "react";
import { Spinner } from "@/components/ui/Spinner";

// The lesson-note editor is the one lesson-notes screen that renders
// `LessonNoteReadView` (read-only/preview mode, and `AiGenerateSheet`'s
// completed-generation preview), which pulls in `MathText` and so KaTeX
// (~270KB) - lazy-loaded so that cost only downloads for someone who opens a
// note, not on every page load. Same pattern as `TemplateDesignerRoute`, and
// kept in its own file for the same reason: `routes/index.tsx` also exports
// the non-component `routes`/`router` values, which Fast Refresh can't mix
// with a component definition.
const LessonNoteEditorPage = lazy(() =>
  import("@/features/lessonNotes/LessonNoteEditorPage").then((module) => ({
    default: module.LessonNoteEditorPage,
  })),
);

export function LessonNoteEditorRoute() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading lesson note…
        </div>
      }
    >
      <LessonNoteEditorPage />
    </Suspense>
  );
}

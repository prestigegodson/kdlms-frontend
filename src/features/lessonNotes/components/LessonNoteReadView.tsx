import type { ReactNode } from "react";
import type { LessonNoteContentView } from "@/api/lessonNotes";
import { RichContent } from "@/components/richText/RichContent";
import { MathText } from "@/features/lessonNotes/components/MathText";

interface LessonNoteReadViewProps {
  content: LessonNoteContentView;
  /**
   * Resolves a document-mode body's embedded images - every staff call site
   * passes `(fileId, alt) => <AuthenticatedRichImage fileId={fileId} alt={alt} />`;
   * `WardLessonNotesPage` (a `GUARDIAN` caller) omits this prop entirely,
   * since `GET /api/v1/files/{id}` only ever authorizes staff roles and a
   * guardian's token carries no `schoolId` to scope a read by (CLAUDE.md's
   * cross-school guardian rule) - `RichContent` silently drops an `<img>`
   * with no `renderImage` callback, so a ward's document-mode note still
   * reads fine, just without its pictures. No default value here
   * deliberately: a destructuring default can't distinguish "omitted" from
   * "explicitly undefined", so each caller states its own intent.
   */
  renderImage?: (fileId: string, alt: string) => ReactNode;
}

/**
 * A purely presentational, read-only render of a lesson note's content.
 * Branches on {@link LessonNoteContentView.mode} (Phase 16G): `DOCUMENT`
 * renders the free-form body through `RichContent` (the same renderer the
 * take-home quiz module uses, widened for lesson notes - see
 * `LessonNoteRichText`'s vocabulary); `STRUCTURED` renders the original
 * fixed section order below - headings, prose, and bulleted lists, skipping
 * any section that's blank or an empty list, and rendering every prose/list
 * value through {@link MathText} so an AI-generated note's inline LaTeX
 * (`\( ... \)`, per `LessonNotePromptBuilder`'s system-prompt contract)
 * shows as real typeset maths rather than literal source. Owned by the
 * `lessonNotes` feature and shared across every place a note is *read*
 * rather than edited: `WardLessonNotesPage` (a parent reading an approved
 * note), `LessonNoteEditorPage`'s own read-only mode (a reviewing admin, or
 * a teacher's own submitted/approved note - a `disabled` textarea can't
 * render maths, so it stopped being the read-only surface here), and
 * `AiGenerateSheet`'s completed-generation preview - the "one component,
 * several callers" precedent `AttendanceSummaryPanel`/`ThreadCard` set.
 */
export function LessonNoteReadView({ content, renderImage }: LessonNoteReadViewProps) {
  if (content.mode === "DOCUMENT") {
    return <RichContent html={content.body ?? ""} renderImage={renderImage} className="space-y-2 text-sm" />;
  }

  const header = [
    content.subTopic && { label: "Sub-topic", value: content.subTopic },
    content.duration && { label: "Duration", value: content.duration },
    content.averageAge && { label: "Average age", value: content.averageAge },
  ].filter((entry): entry is { label: string; value: string } => Boolean(entry));

  return (
    <div className="space-y-5 text-sm">
      {header.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-3">
          {header.map((entry) => (
            <div key={entry.label}>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                {entry.label}
              </p>
              <p className="text-slate-900">
                <MathText text={entry.value} />
              </p>
            </div>
          ))}
        </div>
      )}

      <Section label="Entry behaviour" text={content.entryBehaviour} />
      <ListSection label="Behavioural objectives" values={content.objectives} />
      <ListSection label="Instructional materials" values={content.instructionalMaterials} />
      <ListSection label="References" values={content.references} />

      {content.presentation.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
            Presentation
          </p>
          <div className="space-y-3">
            {content.presentation.map((step, index) => (
              <div key={index} className="rounded-control border border-slate-200 p-3">
                <p className="mb-1 text-sm font-medium text-slate-900">
                  {step.label || `Step ${index + 1}`}
                </p>
                {step.teacherActivity && (
                  <p className="text-slate-700">
                    <span className="font-medium text-slate-500">Teacher: </span>
                    <MathText text={step.teacherActivity} />
                  </p>
                )}
                {step.learnerActivity && (
                  <p className="text-slate-700">
                    <span className="font-medium text-slate-500">Learners: </span>
                    <MathText text={step.learnerActivity} />
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <Section label="Evaluation" text={content.evaluation} />
      <Section label="Conclusion" text={content.conclusion} />
      <Section label="Assignment" text={content.assignment} />
    </div>
  );
}

function Section({ label, text }: { label: string; text: string | null }) {
  if (!text) return null;
  return (
    <div>
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="whitespace-pre-wrap text-slate-900">
        <MathText text={text} />
      </p>
    </div>
  );
}

function ListSection({ label, values }: { label: string; values: string[] }) {
  const nonBlank = values.filter((value) => value.trim() !== "");
  if (nonBlank.length === 0) return null;
  return (
    <div>
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <ul className="list-disc space-y-0.5 pl-5 text-slate-900">
        {nonBlank.map((value, index) => (
          <li key={index}>
            <MathText text={value} />
          </li>
        ))}
      </ul>
    </div>
  );
}

import { useEffect, useState } from "react";
import { ChevronRight, NotebookPen } from "lucide-react";
import { ApiError } from "@/api/client";
import {
  getWardLessonNote,
  getWardLessonNotes,
  listWardTerms,
  type WardSubjectLessonNotesView,
  type WardTermView,
} from "@/api/wards";
import type { LessonNoteView } from "@/api/lessonNotes";
import { Accordion } from "@/components/ui/Accordion";
import { Alert } from "@/components/ui/Alert";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { FormField } from "@/components/ui/FormField";
import { LessonNoteReadView } from "@/features/lessonNotes/components/LessonNoteReadView";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { Select } from "@/components/ui/Select";
import { Spinner } from "@/components/ui/Spinner";
import { StickySubHeader } from "@/components/ui/StickySubHeader";
import { WardSelector } from "@/features/guardian/components/WardSelector";
import { useWardStore } from "@/stores/wardStore";

/**
 * A ward's lesson notes for one term - `APPROVED`-only (this feature's own
 * publication gate, deliberately not `resultsPublished`-gated like
 * `WardResultsPage`'s drill-down is - see CLAUDE.md's Domain Rules).
 * Follows `WardTimetablePage`'s flat single-page shape rather than the
 * Results/Attendance school→ward→session→term drill-down: like a timetable,
 * this is "one term to check," not a history to browse session by session -
 * `WardSelector` and a plain Term `Select` both dock in one
 * `StickySubHeader`. One `Accordion` per applicable subject (mirroring
 * `StudentDetailPage`'s stacked-sections precedent); a subject with zero
 * approved notes still gets a row, so a parent can see what hasn't been
 * published yet rather than the subject silently vanishing. Tapping a week
 * opens the full note read-only in a `Modal`-as-sheet via
 * `LessonNoteReadView`, the "one component, two callers" precedent
 * `AttendanceSummaryPanel`/`ThreadCard` set.
 */
export function WardLessonNotesPage() {
  const {
    wards,
    selectedWardId,
    status,
    errorMessage: wardsError,
    fetchIfNeeded,
    retry,
  } = useWardStore();

  useEffect(() => {
    fetchIfNeeded();
  }, [fetchIfNeeded]);

  const [terms, setTerms] = useState<WardTermView[]>([]);
  const [termsError, setTermsError] = useState<string | null>(null);
  const [termId, setTermId] = useState("");

  // A ward change resets its term list + selection during render (the
  // WardTimetablePage/WardMessagesPage pattern) rather than inside the
  // effect below, which only fetches.
  const selectionKey = selectedWardId ?? "";
  const [lastSelectionKey, setLastSelectionKey] = useState(selectionKey);
  if (selectionKey !== lastSelectionKey) {
    setLastSelectionKey(selectionKey);
    setTerms([]);
    setTermsError(null);
    setTermId("");
  }

  useEffect(() => {
    if (!selectedWardId) return;
    listWardTerms(selectedWardId)
      .then((fetchedTerms) => {
        setTerms(fetchedTerms);
        const preferred = [...fetchedTerms]
          .filter((term) => term.currentSession)
          .sort((a, b) => b.termNumber - a.termNumber)[0];
        setTermId(preferred?.termId ?? fetchedTerms[0]?.termId ?? "");
      })
      .catch((error: unknown) =>
        setTermsError(error instanceof ApiError ? error.message : "Failed to load this ward's terms"),
      );
  }, [selectedWardId]);

  const [subjects, setSubjects] = useState<WardSubjectLessonNotesView[] | null>(null);
  const [subjectsError, setSubjectsError] = useState<string | null>(null);

  const [lastTermId, setLastTermId] = useState(termId);
  if (termId !== lastTermId) {
    setLastTermId(termId);
    setSubjects(null);
    setSubjectsError(null);
  }

  useEffect(() => {
    if (!selectedWardId || !termId) return;
    getWardLessonNotes(selectedWardId, termId)
      .then(setSubjects)
      .catch((error: unknown) =>
        setSubjectsError(error instanceof ApiError ? error.message : "Failed to load this ward's lesson notes"),
      );
  }, [selectedWardId, termId]);

  const [openNote, setOpenNote] = useState<{ subjectName: string; weekNumber: number } | null>(null);
  const [noteDetail, setNoteDetail] = useState<LessonNoteView | null>(null);
  const [noteError, setNoteError] = useState<string | null>(null);

  function openNoteSheet(subjectName: string, weekNumber: number, noteId: string) {
    setOpenNote({ subjectName, weekNumber });
    setNoteDetail(null);
    setNoteError(null);
    if (!selectedWardId) return;
    getWardLessonNote(selectedWardId, noteId)
      .then(setNoteDetail)
      .catch((error: unknown) => setNoteError(error instanceof ApiError ? error.message : "Failed to load this note"));
  }

  const hasWards = status === "loaded" && wards.length > 0;

  return (
    <div className="space-y-6">
      <PageHeader title="Lesson notes" description="Your ward's approved weekly scheme-of-work notes." />

      {(status === "idle" || status === "loading") && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading…
        </div>
      )}
      {status === "error" && <ErrorState message={wardsError ?? "Failed to load your wards"} onRetry={retry} />}
      {status === "loaded" && wards.length === 0 && (
        <EmptyState title="No wards linked yet" description="Contact your school if you believe this is a mistake." />
      )}

      {hasWards && (
        <StickySubHeader>
          <WardSelector />
          <FormField label="Term" htmlFor="ward-lesson-notes-term" className="min-w-0 flex-1 lg:max-w-xs">
            <Select id="ward-lesson-notes-term" value={termId} onChange={(event) => setTermId(event.target.value)}>
              <option value="">Select a term…</option>
              {terms.map((term) => (
                <option key={term.termId} value={term.termId}>
                  {term.termName} · {term.sessionName}
                </option>
              ))}
            </Select>
          </FormField>
        </StickySubHeader>
      )}

      {termsError && <Alert variant="error">{termsError}</Alert>}
      {subjectsError && <Alert variant="error">{subjectsError}</Alert>}

      {hasWards && terms.length === 0 && !termsError && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading terms…
        </div>
      )}

      {termId && !subjects && !subjectsError && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading lesson notes…
        </div>
      )}

      {subjects && subjects.length === 0 && (
        <EmptyState
          icon={NotebookPen}
          title="No subjects for this term"
          description="This ward has no applicable subjects for the selected term yet."
        />
      )}

      {subjects && subjects.length > 0 && (
        <div className="space-y-3">
          {subjects.map((subject, index) => (
            <Accordion
              key={subject.subjectId}
              title={`${subject.subjectName} · ${subject.notes.length} note${subject.notes.length === 1 ? "" : "s"}`}
              defaultOpen={index === 0}
            >
              {subject.notes.length === 0 ? (
                <p className="text-sm text-slate-400">No notes published yet.</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {subject.notes.map((note) => (
                    <li key={note.noteId}>
                      <button
                        type="button"
                        onClick={() => openNoteSheet(subject.subjectName, note.weekNumber, note.noteId)}
                        className="flex w-full cursor-pointer items-center justify-between gap-2 py-3 text-left mobile:min-h-11"
                      >
                        <span className="text-sm text-slate-900">
                          Week {note.weekNumber} · {note.topic}
                        </span>
                        <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Accordion>
          ))}
        </div>
      )}

      <Modal
        open={openNote !== null}
        onClose={() => setOpenNote(null)}
        title={openNote ? `${openNote.subjectName} · Week ${openNote.weekNumber}` : undefined}
      >
        {noteError && <Alert variant="error">{noteError}</Alert>}
        {!noteDetail && !noteError && (
          <div className="flex items-center gap-2 py-6 text-sm text-slate-500">
            <Spinner /> Loading…
          </div>
        )}
        {noteDetail && (
          <div className="space-y-3">
            <p className="text-base font-semibold text-slate-900">{noteDetail.topic}</p>
            <LessonNoteReadView content={noteDetail.content} />
          </div>
        )}
      </Modal>
    </div>
  );
}

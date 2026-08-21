import { useEffect, useState } from "react";
import { getMyLessonNoteSubjects, getWeekGrid, type LessonNoteWeekView, type LevelSubjectView } from "@/api/lessonNotes";
import { ApiError } from "@/api/client";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Spinner } from "@/components/ui/Spinner";
import { StickySubHeader } from "@/components/ui/StickySubHeader";
import { CopyLessonNotesModal } from "@/features/lessonNotes/components/CopyLessonNotesModal";
import { SubjectTermPicker } from "@/features/lessonNotes/components/SubjectTermPicker";
import { WeekGridTable } from "@/features/lessonNotes/components/WeekGridTable";
import { NotebookPen } from "lucide-react";

/**
 * A TEACHER's own lesson-note subjects and week grid - subjects come from
 * `/me/lesson-note-subjects` (their own subject-teach assignments only,
 * `MyLessonNoteSubjectsUseCase`), narrower than what `LessonNoteAccessGuard`
 * would let them *view* (which also admits a class-teach-only account) -
 * see the picker's own Javadoc-mirroring comment for why. `AdminLessonNotePanel`
 * shares this screen's shape but sources its subjects from the school-wide
 * catalogue instead.
 */
export function TeacherLessonNotePanel() {
  const [subjects, setSubjects] = useState<LevelSubjectView[] | null>(null);
  const [subjectId, setSubjectId] = useState("");
  const [termId, setTermId] = useState("");
  const [weeks, setWeeks] = useState<LessonNoteWeekView[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [copyModalOpen, setCopyModalOpen] = useState(false);

  useEffect(() => {
    getMyLessonNoteSubjects()
      .then(setSubjects)
      .catch(() => setSubjects([]));
  }, []);

  // A subject/term change resets the loaded grid during render (see
  // AdminTimetablePanel's `selectionKey` comment for this pattern) rather
  // than in an effect; the effect below only fetches.
  const selectionKey = `${subjectId}|${termId}`;
  const [lastSelectionKey, setLastSelectionKey] = useState(selectionKey);
  if (selectionKey !== lastSelectionKey) {
    setLastSelectionKey(selectionKey);
    setWeeks(null);
    setLoadError(null);
  }

  useEffect(() => {
    if (!subjectId || !termId) return;
    getWeekGrid(subjectId, termId)
      .then(setWeeks)
      .catch((error: unknown) =>
        setLoadError(error instanceof ApiError ? error.message : "Failed to load lesson notes"),
      );
  }, [subjectId, termId, reloadToken]);

  const subjectOptions = (subjects ?? []).map((subject) => ({
    id: subject.subjectId,
    name: subject.subjectName,
    levelName: subject.levelName,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lesson notes"
        description="Prepare your weekly scheme-of-work notes for a subject."
        actions={
          termId && (
            <Button type="button" variant="secondary" onClick={() => setCopyModalOpen(true)}>
              Copy from another term
            </Button>
          )
        }
      />

      {subjects === null && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading your subjects…
        </div>
      )}

      {subjects !== null && subjects.length === 0 && (
        <EmptyState
          icon={NotebookPen}
          title="No subjects assigned"
          description="You aren't assigned to subject-teach anything yet - ask a school admin to check your subject-teacher assignments."
        />
      )}

      {subjects !== null && subjects.length > 0 && (
        <>
          <StickySubHeader collapsible>
            <SubjectTermPicker
              subjects={subjectOptions}
              subjectId={subjectId}
              onSubjectChange={setSubjectId}
              termId={termId}
              onTermChange={setTermId}
            />
          </StickySubHeader>

          {loadError && <Alert variant="error">{loadError}</Alert>}

          {weeks && weeks.length > 0 && <WeekGridTable weeks={weeks} subjectId={subjectId} termId={termId} />}
          {weeks && weeks.length === 0 && (
            <EmptyState
              icon={NotebookPen}
              title="No weeks in this term"
              description="This term has no dates to derive a week grid from yet."
            />
          )}
        </>
      )}

      {termId && (
        <CopyLessonNotesModal
          open={copyModalOpen}
          onClose={() => setCopyModalOpen(false)}
          targetTermId={termId}
          subjectOptions={subjectOptions}
          defaultSubjectId={subjectId || undefined}
          onCopied={() => setReloadToken((token) => token + 1)}
        />
      )}
    </div>
  );
}

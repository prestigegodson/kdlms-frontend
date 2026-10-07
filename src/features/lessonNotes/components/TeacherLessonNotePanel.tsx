import { useEffect, useState } from "react";
import {
  getMyLessonNoteClasses,
  getMyLessonNoteSubjects,
  getWeekGrid,
  type LessonNoteClassView,
  type LessonNoteWeekView,
  type LevelSubjectView,
} from "@/api/lessonNotes";
import { ApiError } from "@/api/client";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Spinner } from "@/components/ui/Spinner";
import { StickySubHeader } from "@/components/ui/StickySubHeader";
import { Tabs } from "@/components/ui/Tabs";
import { ClassWeekNotesPanel } from "@/features/lessonNotes/components/ClassWeekNotesPanel";
import { CopyLessonNotesModal } from "@/features/lessonNotes/components/CopyLessonNotesModal";
import { SubjectTermPicker } from "@/features/lessonNotes/components/SubjectTermPicker";
import { WeekGridTable } from "@/features/lessonNotes/components/WeekGridTable";
import { NotebookPen } from "lucide-react";

/**
 * A TEACHER's own lesson-note subjects and week grid - subjects come from
 * `/me/lesson-note-subjects` (`MyLessonNoteSubjectsUseCase`): every subject
 * they subject-teach, plus every subject of a class they class-teach or
 * assist. A class teacher may author only those with no subject teacher in
 * their class (`authorable`); the rest are read-only - existing notes open
 * read-only in the editor, empty weeks aren't links, and the copy action
 * offers only authorable subjects. `AdminLessonNotePanel` shares this
 * screen's shape but sources its subjects from the school-wide catalogue
 * instead.
 *
 * A teacher with classes also gets a "By class" tab: whole-class notes, one
 * per class per week covering every subject (`ClassWeekNotesPanel`) - how a
 * primary class teacher who teaches the whole timetable plans their week.
 */
interface TeacherLessonNotePanelProps {
  /** Seeds the initial subject selection (e.g. from SubjectsPage's "Lesson notes" row action). */
  initialSubjectId?: string;
}

export function TeacherLessonNotePanel({ initialSubjectId }: TeacherLessonNotePanelProps = {}) {
  const [subjects, setSubjects] = useState<LevelSubjectView[] | null>(null);
  const [subjectId, setSubjectId] = useState(initialSubjectId ?? "");
  const [termId, setTermId] = useState("");
  const [weeks, setWeeks] = useState<LessonNoteWeekView[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [copyModalOpen, setCopyModalOpen] = useState(false);
  const [classes, setClasses] = useState<LessonNoteClassView[]>([]);
  const [view, setView] = useState<"subject" | "class">("subject");

  useEffect(() => {
    getMyLessonNoteSubjects()
      .then(setSubjects)
      .catch(() => setSubjects([]));
    getMyLessonNoteClasses()
      .then(setClasses)
      .catch(() => setClasses([]));
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

  const toOption = (subject: LevelSubjectView) => ({
    id: subject.subjectId,
    name: subject.subjectName,
    levelName: subject.levelName,
  });
  const subjectOptions = (subjects ?? []).map(toOption);
  const authorableSubjectOptions = (subjects ?? []).filter((subject) => subject.authorable).map(toOption);
  const selectedAuthorable = subjects?.find((subject) => subject.subjectId === subjectId)?.authorable ?? true;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lesson notes"
        description="Prepare your weekly scheme-of-work notes for a subject, or for your whole class."
        actions={
          view === "subject" &&
          termId &&
          authorableSubjectOptions.length > 0 && (
            <Button type="button" variant="secondary" onClick={() => setCopyModalOpen(true)}>
              Copy from another term
            </Button>
          )
        }
      />

      {classes.length > 0 && (
        <Tabs
          ariaLabel="Lesson note scope"
          value={view}
          onChange={setView}
          items={[
            { value: "subject", label: "By subject" },
            { value: "class", label: "By class" },
          ]}
        />
      )}

      {view === "class" && classes.length > 0 && (
        <ClassWeekNotesPanel
          classes={classes.map((option) => ({
            id: option.classId,
            name: option.className,
            levelName: option.levelName,
            authorable: option.authorable,
          }))}
        />
      )}

      {view === "subject" && subjects === null && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading your subjects…
        </div>
      )}

      {view === "subject" && subjects !== null && subjects.length === 0 && (
        <EmptyState
          icon={NotebookPen}
          title="No subjects assigned"
          description="You don't subject-teach or class-teach anything yet - ask a school admin to check your assignments."
        />
      )}

      {view === "subject" && subjects !== null && subjects.length > 0 && (
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

          {subjectId && !selectedAuthorable && (
            <Alert variant="info">
              This subject has a subject teacher - you can read its lesson notes but not edit them.
            </Alert>
          )}

          {weeks && weeks.length > 0 && (
            <WeekGridTable weeks={weeks} subjectId={subjectId} termId={termId} authorable={selectedAuthorable} />
          )}
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
          subjectOptions={authorableSubjectOptions}
          defaultSubjectId={selectedAuthorable ? subjectId || undefined : undefined}
          onCopied={() => setReloadToken((token) => token + 1)}
        />
      )}
    </div>
  );
}

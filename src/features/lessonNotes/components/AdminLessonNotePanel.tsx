import { useEffect, useState } from "react";
import { NotebookPen } from "lucide-react";
import { ApiError } from "@/api/client";
import {
  getReviewQueue,
  getWeekGrid,
  type LessonNoteQueueView,
  type LessonNoteStatus,
  type LessonNoteWeekView,
} from "@/api/lessonNotes";
import { listSubjects, type SubjectView } from "@/api/subjects";
import type { Page } from "@/api/types";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Pagination } from "@/components/ui/Pagination";
import { Spinner } from "@/components/ui/Spinner";
import { StickySubHeader } from "@/components/ui/StickySubHeader";
import { CopyLessonNotesModal } from "@/features/lessonNotes/components/CopyLessonNotesModal";
import { ReviewQueueFilters } from "@/features/lessonNotes/components/ReviewQueueFilters";
import { ReviewQueueTable } from "@/features/lessonNotes/components/ReviewQueueTable";
import { SubjectTermPicker } from "@/features/lessonNotes/components/SubjectTermPicker";
import { WeekGridTable } from "@/features/lessonNotes/components/WeekGridTable";
import { useLevelStore } from "@/stores/levelStore";

type AdminTab = "queue" | "browse";
const PAGE_SIZE = 20;

/**
 * SCHOOL_ADMIN/BRANCH_ADMIN's lesson-notes screen - the "Review queue" tab
 * (default, paginated, Level/Term/Status filters) is the day-to-day review
 * workflow; "Browse by subject" is Phase 16B's original week-grid view,
 * kept as a second tab rather than replaced so an admin can still see one
 * subject's whole term at a glance. `role="tablist"` + a local `TabButton`,
 * per `TeacherTimetablePanel`'s "My timetable"/"Class timetable" precedent.
 */
export function AdminLessonNotePanel() {
  const [tab, setTab] = useState<AdminTab>("queue");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lesson notes"
        description="Review teachers' weekly scheme-of-work notes, or browse a subject's full term."
      />

      <div role="tablist" aria-label="Lesson note views" className="flex gap-1 border-b border-slate-200">
        <TabButton label="Review queue" active={tab === "queue"} onClick={() => setTab("queue")} />
        <TabButton label="Browse by subject" active={tab === "browse"} onClick={() => setTab("browse")} />
      </div>

      {tab === "queue" ? <ReviewQueuePanel /> : <BrowseBySubjectPanel />}
    </div>
  );
}

/** The review queue - defaults to SUBMITTED, since that's the whole point of a queue. */
function ReviewQueuePanel() {
  const [levelId, setLevelId] = useState("");
  const [termId, setTermId] = useState("");
  const [status, setStatus] = useState("SUBMITTED");
  const [pageIndex, setPageIndex] = useState(0);
  const [page, setPage] = useState<Page<LessonNoteQueueView> | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  function resetToFirstPage<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value);
      setPageIndex(0);
    };
  }

  useEffect(() => {
    getReviewQueue(
      levelId || undefined,
      termId || undefined,
      (status || undefined) as LessonNoteStatus | undefined,
      pageIndex,
      PAGE_SIZE,
    )
      .then((result) => {
        setPage(result);
        setLoadError(null);
      })
      .catch((error: unknown) =>
        setLoadError(error instanceof ApiError ? error.message : "Failed to load the review queue"),
      );
  }, [levelId, termId, status, pageIndex]);

  return (
    <div className="space-y-6">
      <StickySubHeader collapsible>
        <ReviewQueueFilters
          levelId={levelId}
          onLevelChange={resetToFirstPage(setLevelId)}
          termId={termId}
          onTermChange={resetToFirstPage(setTermId)}
          status={status}
          onStatusChange={resetToFirstPage(setStatus)}
        />
      </StickySubHeader>

      {loadError && <Alert variant="error">{loadError}</Alert>}

      {!page && !loadError && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading review queue…
        </div>
      )}

      {page && page.content.length === 0 && (
        <EmptyState
          icon={NotebookPen}
          title="Nothing to review"
          description="No lesson notes match these filters."
        />
      )}

      {page && page.content.length > 0 && (
        <>
          <ReviewQueueTable rows={page.content} />
          <Pagination page={page} onPageChange={setPageIndex} />
        </>
      )}
    </div>
  );
}

/**
 * Phase 16B's original view - subjects come from the school-wide catalogue
 * (`listSubjects()`, no `levelId` narrows to one level), unlike
 * `TeacherLessonNotePanel`'s own-assignment-only source, since an admin's
 * access is school-wide (no branch scoping - see `LessonNoteAccessGuard`'s
 * Javadoc). Level names come from `levelStore` to disambiguate subjects
 * that share a name across levels.
 */
function BrowseBySubjectPanel() {
  const levels = useLevelStore((state) => state.levels);
  const fetchLevels = useLevelStore((state) => state.fetchIfNeeded);

  const [subjects, setSubjects] = useState<SubjectView[] | null>(null);
  const [subjectId, setSubjectId] = useState("");
  const [termId, setTermId] = useState("");
  const [weeks, setWeeks] = useState<LessonNoteWeekView[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [copyModalOpen, setCopyModalOpen] = useState(false);

  useEffect(() => {
    fetchLevels();
  }, [fetchLevels]);

  useEffect(() => {
    listSubjects(undefined, 0, 500)
      .then((page) => setSubjects(page.content))
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

  const levelNameOf = (levelId: string) => levels.find((level) => level.id === levelId)?.displayName;
  const subjectOptions = (subjects ?? []).map((subject) => ({
    id: subject.id,
    name: subject.name,
    levelName: levelNameOf(subject.levelId),
  }));

  return (
    <div className="space-y-6">
      {subjects === null && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading subjects…
        </div>
      )}

      {subjects !== null && subjects.length === 0 && (
        <EmptyState
          icon={NotebookPen}
          title="No subjects yet"
          description="Set up the subject catalogue before lesson notes can be authored."
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

          {termId && (
            <div className="flex justify-end">
              <Button type="button" variant="secondary" onClick={() => setCopyModalOpen(true)}>
                Copy from another term
              </Button>
            </div>
          )}

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

interface TabButtonProps {
  label: string;
  active: boolean;
  onClick: () => void;
}

function TabButton({ label, active, onClick }: TabButtonProps) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`cursor-pointer border-b-2 px-3 py-2 text-sm font-medium mobile:min-h-11 ${
        active ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-700"
      }`}
    >
      {label}
    </button>
  );
}

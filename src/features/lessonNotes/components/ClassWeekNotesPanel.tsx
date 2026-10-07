import { type ReactNode, useEffect, useState } from "react";
import { NotebookPen } from "lucide-react";
import { ApiError } from "@/api/client";
import { getClassWeekGrid, type ClassWeekGridView } from "@/api/lessonNotes";
import { Alert } from "@/components/ui/Alert";
import { EmptyState } from "@/components/ui/EmptyState";
import { StickySubHeader } from "@/components/ui/StickySubHeader";
import { SubjectTermPicker } from "@/features/lessonNotes/components/SubjectTermPicker";
import { WeekGridTable } from "@/features/lessonNotes/components/WeekGridTable";

export interface ClassOption {
  id: string;
  name: string;
  levelName?: string;
  /** False when the caller may only read this class's whole-class notes. */
  authorable: boolean;
}

interface ClassWeekNotesPanelProps {
  classes: ClassOption[];
  /** Extra filters docked ahead of the picker - the admin panel's `BranchFilter`. */
  filters?: ReactNode;
}

/**
 * Whole-class notes: one note per class per week covering every subject, the
 * shape class teachers of primary and below use since they teach the whole
 * timetable. Pick a class and term, then open a week - the same
 * `WeekGridTable`/editor pair the subject view uses, addressed by `classId`.
 * The caller supplies the classes: a teacher's own (`/me/lesson-note-classes`)
 * or, for an admin, the selected branch's.
 */
export function ClassWeekNotesPanel({ classes, filters }: ClassWeekNotesPanelProps) {
  const [classId, setClassId] = useState("");
  const [termId, setTermId] = useState("");
  const [grid, setGrid] = useState<ClassWeekGridView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // A class/term change resets the loaded grid during render (AdminTimetablePanel's
  // `selectionKey` pattern); the effect below only fetches.
  const selectionKey = `${classId}|${termId}`;
  const [lastSelectionKey, setLastSelectionKey] = useState(selectionKey);
  if (selectionKey !== lastSelectionKey) {
    setLastSelectionKey(selectionKey);
    setGrid(null);
    setLoadError(null);
  }

  useEffect(() => {
    if (!classId || !termId) return;
    getClassWeekGrid(classId, termId)
      .then(setGrid)
      .catch((error: unknown) =>
        setLoadError(error instanceof ApiError ? error.message : "Failed to load lesson notes"),
      );
  }, [classId, termId]);

  const authorable = classes.find((option) => option.id === classId)?.authorable ?? true;

  if (classes.length === 0) {
    return (
      <EmptyState
        icon={NotebookPen}
        title="No classes"
        description="Whole-class notes are written by a class's class teacher."
      />
    );
  }

  return (
    <div className="space-y-6">
      <StickySubHeader collapsible>
        {filters}
        <SubjectTermPicker
          itemLabel="Class"
          subjects={classes}
          subjectId={classId}
          onSubjectChange={setClassId}
          termId={termId}
          onTermChange={setTermId}
        />
      </StickySubHeader>

      {loadError && <Alert variant="error">{loadError}</Alert>}

      {classId && !authorable && (
        <Alert variant="info">
          Only this class's class teacher writes its whole-class notes - you can read them here.
        </Alert>
      )}

      {grid && grid.weeks.length > 0 && (
        <WeekGridTable
          weeks={grid.weeks}
          classId={classId}
          termId={termId}
          authorable={authorable}
        />
      )}
      {grid && grid.weeks.length === 0 && (
        <EmptyState
          icon={NotebookPen}
          title="No weeks in this term"
          description="This term has no dates to derive a week grid from yet."
        />
      )}
    </div>
  );
}

import { useEffect, useState } from "react";
import { type BroadsheetView, getBroadsheet } from "@/api/assessments";
import { ApiError } from "@/api/client";
import { getGradingSystem, type GradingSystemView } from "@/api/gradingSystems";
import { listMyClasses, type TeacherClassView } from "@/api/me";
import type { ResultScope } from "@/api/types";
import { Alert } from "@/components/ui/Alert";
import { EmptyState } from "@/components/ui/EmptyState";
import { Spinner } from "@/components/ui/Spinner";
import { StickySubHeader } from "@/components/ui/StickySubHeader";
import { broadsheetPrintTitle } from "@/features/assessments/broadsheet";
import { BroadsheetActions } from "@/features/assessments/components/BroadsheetActions";
import { BroadsheetPrintArea } from "@/features/assessments/components/BroadsheetPrintArea";
import { BroadsheetTable } from "@/features/assessments/components/BroadsheetTable";
import { ClassTermPicker } from "@/features/assessments/components/ClassTermPicker";
import { GradeKey } from "@/features/assessments/components/GradeKey";
import { ScopeToggle } from "@/features/assessments/components/ScopeToggle";
import { useBroadsheetPrint } from "@/features/assessments/useBroadsheetPrint";
import { BarChart3 } from "lucide-react";

interface TeacherBroadsheetPanelProps {
  /** Seeds the initial class selection (e.g. from ClassDetailPage's "Results & broadsheet" quick link). */
  initialClassId?: string;
}

/**
 * A class/assistant teacher's read-only broadsheet for their own classes -
 * the "Broadsheet" tab body under `AssessmentsPage`, so it carries no title
 * of its own. The read half of `AdminResultsPanel` (no publish, no principal
 * remark, no branch filter): a subject-only teacher never sees it, since the
 * broadsheet exposes every subject's scores - the server 404s them too (see
 * `AssessmentAccessGuard.requireBroadsheetVisible`).
 */
export function TeacherBroadsheetPanel({ initialClassId }: TeacherBroadsheetPanelProps = {}) {
  const [classes, setClasses] = useState<TeacherClassView[] | null>(null);
  const [classId, setClassId] = useState(initialClassId ?? "");
  const [termId, setTermId] = useState("");
  const [scope, setScope] = useState<ResultScope>("TERM");
  const [labels, setLabels] = useState<{ sessionName?: string; termName?: string }>({});
  const { printing, print } = useBroadsheetPrint();

  const [broadsheet, setBroadsheet] = useState<BroadsheetView | null>(null);
  const [gradingSystem, setGradingSystem] = useState<GradingSystemView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    listMyClasses()
      .then((all) => setClasses(all.filter((c) => c.isClassTeacher)))
      .catch(() => setClasses([]));
  }, []);

  // Selection resets downstream state during render (see ScoreEntryGrid's comment on this
  // pattern) rather than in an effect; the effect below only fetches.
  const selectionKey = `${classId}|${termId}|${scope}`;
  const [lastSelectionKey, setLastSelectionKey] = useState(selectionKey);
  if (selectionKey !== lastSelectionKey) {
    setLastSelectionKey(selectionKey);
    setBroadsheet(null);
    setGradingSystem(null);
    setLoadError(null);
  }

  // The initial `?classId=` can arrive before the class list - refetch once it lands, for the grading key.
  const classesLoaded = classes !== null;
  useEffect(() => {
    if (!classId || !termId) return;
    getBroadsheet(classId, termId, scope)
      .then(setBroadsheet)
      .catch((error: unknown) => setLoadError(error instanceof ApiError ? error.message : "Failed to load results"));

    const selectedClass = classes?.find((c) => c.classId === classId);
    if (selectedClass) {
      getGradingSystem(selectedClass.levelId)
        .then(setGradingSystem)
        .catch(() => setGradingSystem(null));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- classes is read for the levelId lookup, not a trigger
  }, [classId, termId, scope, classesLoaded]);

  if (classes === null) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Spinner /> Loading classes…
      </div>
    );
  }
  if (classes.length === 0) {
    return (
      <EmptyState
        icon={BarChart3}
        title="No class to show"
        description="The broadsheet is available to the class teacher and assistant teacher of a class."
      />
    );
  }

  const classOptions = classes.map((c) => ({ id: c.classId, name: c.className }));
  const className = classes.find((c) => c.classId === classId)?.className ?? "";

  return (
    <div className="space-y-6">
      <StickySubHeader collapsible>
        <ClassTermPicker
          classes={classOptions}
          classId={classId}
          onClassChange={setClassId}
          termId={termId}
          onTermChange={setTermId}
          onLabelsChange={setLabels}
        />
        <ScopeToggle scope={scope} onChange={setScope} />
      </StickySubHeader>

      {loadError && <Alert variant="error">{loadError}</Alert>}

      {broadsheet && broadsheet.rows.length > 0 && (
        <BroadsheetActions
          broadsheet={broadsheet}
          scope={scope}
          fileStem={`${className} ${labels.termName ?? ""}`}
          onPrint={print}
        />
      )}

      <BroadsheetPrintArea printing={printing} title={broadsheetPrintTitle(className, labels, scope)}>
        {gradingSystem && <GradeKey system={gradingSystem} />}
        {broadsheet && broadsheet.rows.length > 0 && <BroadsheetTable broadsheet={broadsheet} scope={scope} />}
      </BroadsheetPrintArea>

      {broadsheet && broadsheet.rows.length === 0 && (
        <EmptyState icon={BarChart3} title="No results recorded for this term yet" />
      )}
    </div>
  );
}

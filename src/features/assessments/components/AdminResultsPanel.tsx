import { useEffect, useState } from "react";
import {
  type BroadsheetView,
  getBroadsheet,
  getPublicationStatus,
  getRemarksSheet,
  publishResults,
  type RemarksSheetView,
  type RowOutcome,
  unpublishResults,
} from "@/api/assessments";
import { ApiError } from "@/api/client";
import { listClasses, type SchoolClassView } from "@/api/classes";
import { getGradingSystem, type GradingSystemView } from "@/api/gradingSystems";
import type { ResultScope } from "@/api/types";
import { can } from "@/auth/permissions";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Spinner } from "@/components/ui/Spinner";
import { StickySubHeader } from "@/components/ui/StickySubHeader";
import { BroadsheetTable } from "@/features/assessments/components/BroadsheetTable";
import { ClassTermPicker } from "@/features/assessments/components/ClassTermPicker";
import { GradeKey } from "@/features/assessments/components/GradeKey";
import { RemarksEntryGrid } from "@/features/assessments/components/RemarksEntryGrid";
import { SaveOutcomeList } from "@/features/assessments/components/SaveOutcomeList";
import { ScopeToggle } from "@/features/assessments/components/ScopeToggle";
import { BranchFilter } from "@/features/branches/components/BranchFilter";
import { useBranchScope } from "@/features/branches/useBranchScope";
import { useAuthStore } from "@/stores/authStore";
import { BarChart3 } from "lucide-react";

interface AdminResultsPanelProps {
  /** Seeds the initial class selection (e.g. from ClassDetailPage's "Results & broadsheet" quick link). */
  initialClassId?: string;
}

/** An admin's read-only view: pick a class + term, see the broadsheet, and publish/unpublish results for guardians. */
export function AdminResultsPanel({ initialClassId }: AdminResultsPanelProps = {}) {
  const role = useAuthStore((state) => state.user?.role);
  const canPublish = can.publishResults(role);
  const canRecordPrincipalRemark = can.recordPrincipalRemark(role);
  const { ready: branchReady, branchId } = useBranchScope();

  const [classes, setClasses] = useState<SchoolClassView[] | null>(null);
  const [classId, setClassId] = useState(initialClassId ?? "");
  const [termId, setTermId] = useState("");
  const [scope, setScope] = useState<ResultScope>("TERM");

  const [broadsheet, setBroadsheet] = useState<BroadsheetView | null>(null);
  const [gradingSystem, setGradingSystem] = useState<GradingSystemView | null>(null);
  const [published, setPublished] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [remarksSheet, setRemarksSheet] = useState<RemarksSheetView | null>(null);
  const [remarkOutcomes, setRemarkOutcomes] = useState<RowOutcome[] | null>(null);

  useEffect(() => {
    if (!branchReady) return;
    listClasses(branchId, undefined, 0, 200)
      .then((page) => setClasses(page.content))
      .catch(() => setClasses([]));
  }, [branchReady, branchId]);

  // A branch change clears the class selection during render (same idiom as below) - a class
  // from the previous branch would otherwise 404 once the class list has re-fetched.
  const [lastBranchId, setLastBranchId] = useState(branchId);
  if (branchId !== lastBranchId) {
    setLastBranchId(branchId);
    setClassId("");
  }

  // Selection resets downstream state during render (see ScoreEntryGrid's comment on this
  // pattern) rather than in an effect; the effect below only fetches.
  const selectionKey = `${classId}|${termId}|${scope}`;
  const [lastSelectionKey, setLastSelectionKey] = useState(selectionKey);
  if (selectionKey !== lastSelectionKey) {
    setLastSelectionKey(selectionKey);
    setBroadsheet(null);
    setGradingSystem(null);
    setLoadError(null);
    setRemarksSheet(null);
    setRemarkOutcomes(null);
  }

  useEffect(() => {
    if (!classId || !termId) return;
    getBroadsheet(classId, termId, scope)
      .then(setBroadsheet)
      .catch((error: unknown) => setLoadError(error instanceof ApiError ? error.message : "Failed to load results"));

    const selectedClass = classes?.find((c) => c.id === classId);
    if (selectedClass) {
      getGradingSystem(selectedClass.levelId)
        .then(setGradingSystem)
        .catch(() => setGradingSystem(null));
    }
    if (canPublish) {
      getPublicationStatus(classId, termId, scope)
        .then((status) => setPublished(status.published))
        .catch(() => undefined);
    }
    if (canRecordPrincipalRemark) {
      getRemarksSheet(classId, termId)
        .then(setRemarksSheet)
        .catch(() => setRemarksSheet(null));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- classes/canPublish/canRecordPrincipalRemark are read for the levelId lookup and gates, not triggers
  }, [classId, termId, scope]);

  function reloadRemarksSheet() {
    if (!classId || !termId) return;
    getRemarksSheet(classId, termId).then(setRemarksSheet).catch(() => undefined);
  }

  function handleRemarksSaved(outcomes: RowOutcome[]) {
    setRemarkOutcomes(outcomes);
    reloadRemarksSheet();
  }

  async function togglePublish() {
    setActionError(null);
    setPublishing(true);
    try {
      if (published) {
        await unpublishResults(classId, termId, scope);
      } else {
        await publishResults(classId, termId, scope);
      }
      setPublished(!published);
    } catch (error) {
      setActionError(error instanceof ApiError ? error.message : "That action failed");
    } finally {
      setPublishing(false);
    }
  }

  const classOptions = (classes ?? []).map((c) => ({ id: c.id, name: c.name }));
  const showsBranchFilter = can.selectBranch(role);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Assessments"
        description="Pick a class and term to see its results."
        actions={
          canPublish &&
          broadsheet && (
            <Button variant={published ? "secondary" : "accent"} loading={publishing} onClick={togglePublish}>
              {scope === "MIDTERM"
                ? published
                  ? "Unpublish mid-term results"
                  : "Publish mid-term results"
                : published
                  ? "Unpublish results"
                  : "Publish results"}
            </Button>
          )
        }
      />

      {classes === null && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading classes…
        </div>
      )}

      {classes !== null && (classes.length > 0 || showsBranchFilter) && (
        <StickySubHeader collapsible>
          <BranchFilter id="assessments-branch" />
          {classes.length > 0 && (
            <ClassTermPicker classes={classOptions} classId={classId} onClassChange={setClassId} termId={termId} onTermChange={setTermId} />
          )}
          <ScopeToggle scope={scope} onChange={setScope} />
        </StickySubHeader>
      )}

      {loadError && <Alert variant="error">{loadError}</Alert>}

      {canPublish && broadsheet && (
        <Badge variant={published ? "success" : "neutral"}>{published ? "Published" : "Not yet published"}</Badge>
      )}
      {actionError && <Alert variant="error">{actionError}</Alert>}

      {gradingSystem && <GradeKey system={gradingSystem} />}

      {broadsheet && broadsheet.rows.length === 0 && (
        <EmptyState icon={BarChart3} title="No results recorded for this term yet" />
      )}
      {broadsheet && broadsheet.rows.length > 0 && <BroadsheetTable broadsheet={broadsheet} scope={scope} />}

      {canRecordPrincipalRemark && remarksSheet && (
        <div className="space-y-4">
          <h2 className="font-display text-lg font-medium text-slate-900">Principal's remarks</h2>
          <RemarksEntryGrid sheet={remarksSheet} field="principal" onSaved={handleRemarksSaved} />
          {remarkOutcomes && (
            <SaveOutcomeList
              outcomes={remarkOutcomes}
              nameOf={(id) => remarksSheet.rows.find((row) => row.enrollmentId === id)?.studentName ?? id}
            />
          )}
        </div>
      )}
    </div>
  );
}

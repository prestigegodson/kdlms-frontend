import { useEffect, useState } from "react";
import {
  type BroadsheetView,
  getBroadsheet,
  getPublicationStatus,
  publishResults,
  unpublishResults,
} from "@/api/assessments";
import { ApiError } from "@/api/client";
import { listClasses, type SchoolClassView } from "@/api/classes";
import { getGradingSystem, type GradingSystemView } from "@/api/gradingSystems";
import { can } from "@/auth/permissions";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Spinner } from "@/components/ui/Spinner";
import { BroadsheetTable } from "@/features/assessments/components/BroadsheetTable";
import { ClassTermPicker } from "@/features/assessments/components/ClassTermPicker";
import { GradeKey } from "@/features/assessments/components/GradeKey";
import { useAuthStore } from "@/stores/authStore";
import { BarChart3 } from "lucide-react";

/** An admin's read-only view: pick a class + term, see the broadsheet, and publish/unpublish results for guardians. */
export function AdminResultsPanel() {
  const role = useAuthStore((state) => state.user?.role);
  const canPublish = can.publishResults(role);

  const [classes, setClasses] = useState<SchoolClassView[] | null>(null);
  const [classId, setClassId] = useState("");
  const [termId, setTermId] = useState("");

  const [broadsheet, setBroadsheet] = useState<BroadsheetView | null>(null);
  const [gradingSystem, setGradingSystem] = useState<GradingSystemView | null>(null);
  const [published, setPublished] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    listClasses(undefined, undefined, 0, 200)
      .then((page) => setClasses(page.content))
      .catch(() => setClasses([]));
  }, []);

  // Selection resets downstream state during render (see ScoreEntryGrid's comment on this
  // pattern) rather than in an effect; the effect below only fetches.
  const selectionKey = `${classId}|${termId}`;
  const [lastSelectionKey, setLastSelectionKey] = useState(selectionKey);
  if (selectionKey !== lastSelectionKey) {
    setLastSelectionKey(selectionKey);
    setBroadsheet(null);
    setGradingSystem(null);
    setLoadError(null);
  }

  useEffect(() => {
    if (!classId || !termId) return;
    getBroadsheet(classId, termId)
      .then(setBroadsheet)
      .catch((error: unknown) => setLoadError(error instanceof ApiError ? error.message : "Failed to load results"));

    const selectedClass = classes?.find((c) => c.id === classId);
    if (selectedClass) {
      getGradingSystem(selectedClass.levelId)
        .then(setGradingSystem)
        .catch(() => setGradingSystem(null));
    }
    if (canPublish) {
      getPublicationStatus(classId, termId)
        .then((status) => setPublished(status.published))
        .catch(() => undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- classes/canPublish are read for the levelId lookup and publish gate, not triggers
  }, [classId, termId]);

  async function togglePublish() {
    setActionError(null);
    setPublishing(true);
    try {
      if (published) {
        await unpublishResults(classId, termId);
      } else {
        await publishResults(classId, termId);
      }
      setPublished(!published);
    } catch (error) {
      setActionError(error instanceof ApiError ? error.message : "That action failed");
    } finally {
      setPublishing(false);
    }
  }

  const classOptions = (classes ?? []).map((c) => ({ id: c.id, name: c.name }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Assessments"
        description="Pick a class and term to see its results."
        actions={
          canPublish &&
          broadsheet && (
            <Button variant={published ? "secondary" : "accent"} loading={publishing} onClick={togglePublish}>
              {published ? "Unpublish results" : "Publish results"}
            </Button>
          )
        }
      />

      {classes === null && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading classes…
        </div>
      )}

      {classes !== null && classes.length > 0 && (
        <ClassTermPicker classes={classOptions} classId={classId} onClassChange={setClassId} termId={termId} onTermChange={setTermId} />
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
      {broadsheet && broadsheet.rows.length > 0 && <BroadsheetTable broadsheet={broadsheet} />}
    </div>
  );
}

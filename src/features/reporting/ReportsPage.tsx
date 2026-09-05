import { FileText } from "lucide-react";
import { useEffect, useState } from "react";
import { getBroadsheet } from "@/api/assessments";
import { ApiError } from "@/api/client";
import { listClasses, type SchoolClassView } from "@/api/classes";
import { previewStudentReport } from "@/api/reports";
import type { ResultScope } from "@/api/types";
import { can } from "@/auth/permissions";
import { Alert } from "@/components/ui/Alert";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { Spinner } from "@/components/ui/Spinner";
import { StickySubHeader } from "@/components/ui/StickySubHeader";
import { ClassTermPicker } from "@/features/assessments/components/ClassTermPicker";
import { ScopeToggle } from "@/features/assessments/components/ScopeToggle";
import { BranchFilter } from "@/features/branches/components/BranchFilter";
import { useBranchScope } from "@/features/branches/useBranchScope";
import { ClassReportExportCard } from "@/features/reporting/components/ClassReportExportCard";
import { ReportPreviewFrame } from "@/features/reporting/components/ReportPreviewFrame";
import { type ReportStudentRow, StudentReportList } from "@/features/reporting/components/StudentReportList";
import { useAuthStore } from "@/stores/authStore";

/**
 * Term result reports for a class: pick a class and term, then preview or
 * download each student's report, or queue the whole class as one bulk ZIP
 * export (`ClassReportExportCard`, Phase 19). Reuses `getBroadsheet` for the
 * roster - the same visibility the results screen already has, rather than a
 * new roster endpoint.
 */
export function ReportsPage() {
  const role = useAuthStore((state) => state.user?.role);
  const showsBranchFilter = can.selectBranch(role);
  const { ready: branchReady, branchId } = useBranchScope();

  const [classes, setClasses] = useState<SchoolClassView[] | null>(null);
  const [classId, setClassId] = useState("");
  const [termId, setTermId] = useState("");
  const [scope, setScope] = useState<ResultScope>("TERM");
  const [students, setStudents] = useState<ReportStudentRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [previewStudentId, setPreviewStudentId] = useState<string | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

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

  // Selection resets downstream state during render (the pattern `AdminResultsPanel`
  // documents) rather than in an effect; the effect below only fetches.
  const selectionKey = `${classId}|${termId}|${scope}`;
  const [lastSelectionKey, setLastSelectionKey] = useState(selectionKey);
  if (selectionKey !== lastSelectionKey) {
    setLastSelectionKey(selectionKey);
    setStudents(null);
    setLoadError(null);
  }

  useEffect(() => {
    if (!classId || !termId) return;
    getBroadsheet(classId, termId, scope)
      .then((broadsheet) =>
        setStudents(
          broadsheet.rows.map((row) => ({
            studentId: row.studentId,
            studentName: row.studentName,
            admissionNumber: row.admissionNumber,
          })),
        ),
      )
      .catch((error: unknown) => setLoadError(error instanceof ApiError ? error.message : "Failed to load results"));
  }, [classId, termId, scope]);

  async function handlePreview(studentId: string) {
    setPreviewStudentId(studentId);
    setPreviewHtml(null);
    setPreviewError(null);
    try {
      const html = await previewStudentReport(studentId, termId, scope);
      setPreviewHtml(html);
    } catch (error) {
      setPreviewError(error instanceof ApiError ? error.message : "Failed to render this report");
    }
  }

  const classOptions = (classes ?? []).map((schoolClass) => ({ id: schoolClass.id, name: schoolClass.name }));

  return (
    <div className="space-y-6">
      <PageHeader title="Reports" description="Preview and download personalized result reports for a class." />

      {classes === null && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading classes…
        </div>
      )}
      {classes !== null && (classes.length > 0 || showsBranchFilter) && (
        <StickySubHeader collapsible>
          <BranchFilter id="reports-branch" />
          {classes.length > 0 && (
            <ClassTermPicker
              classes={classOptions}
              classId={classId}
              onClassChange={setClassId}
              termId={termId}
              onTermChange={setTermId}
            />
          )}
          <ScopeToggle scope={scope} onChange={setScope} />
        </StickySubHeader>
      )}

      {loadError && <Alert variant="error">{loadError}</Alert>}

      {classId && termId && students === null && !loadError && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading students…
        </div>
      )}
      {students && students.length === 0 && (
        <EmptyState
          icon={FileText}
          title="No results recorded for this term yet"
          description="Ask the class teacher to enter scores before generating reports."
        />
      )}
      {students && students.length > 0 && (
        <>
          <ClassReportExportCard classId={classId} termId={termId} scope={scope} />
          <StudentReportList students={students} termId={termId} scope={scope} onPreview={handlePreview} />
        </>
      )}

      {previewStudentId && (
        <Modal open onClose={() => setPreviewStudentId(null)} title="Report preview" size="xl">
          {previewError && <Alert variant="error">{previewError}</Alert>}
          {!previewError && !previewHtml && (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Spinner /> Rendering…
            </div>
          )}
          {previewHtml && <ReportPreviewFrame html={previewHtml} />}
        </Modal>
      )}
    </div>
  );
}

import { Eye, FileText } from "lucide-react";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { getBroadsheet } from "@/api/assessments";
import { ApiError } from "@/api/client";
import { listClasses, type SchoolClassView } from "@/api/classes";
import type { ResultScope } from "@/api/types";
import { can } from "@/auth/permissions";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Spinner } from "@/components/ui/Spinner";
import { StickySubHeader } from "@/components/ui/StickySubHeader";
import { ClassTermPicker } from "@/features/assessments/components/ClassTermPicker";
import { ScopeToggle } from "@/features/assessments/components/ScopeToggle";
import { BranchFilter } from "@/features/branches/components/BranchFilter";
import { useBranchScope } from "@/features/branches/useBranchScope";
import { ClassReportExportCard } from "@/features/reporting/components/ClassReportExportCard";
import { ReportPreviewNavigator } from "@/features/reporting/components/ReportPreviewNavigator";
import { type ReportStudentRow, StudentReportList } from "@/features/reporting/components/StudentReportList";
import { useAuthStore } from "@/stores/authStore";
import { useBranchStore } from "@/stores/branchStore";

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
  // ClassDetailPage's "See all reports" deep-links ?classId; ClassTermPicker then lands on the current term.
  const [searchParams] = useSearchParams();
  const [classId, setClassId] = useState(searchParams.get("classId") ?? "");
  const [termId, setTermId] = useState("");
  const [scope, setScope] = useState<ResultScope>("TERM");
  const [students, setStudents] = useState<ReportStudentRow[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [previewStudentId, setPreviewStudentId] = useState<string | null>(null);

  useEffect(() => {
    if (!branchReady) return;
    listClasses(branchId, undefined, 0, 200)
      .then((page) => setClasses(page.content))
      .catch(() => setClasses([]));
  }, [branchReady, branchId]);

  // A deep link's ?branchId (a SCHOOL_ADMIN's branch filter only) is switched to once the branch
  // list loads, so the linked class shows in the Class select; cleared once reached.
  const [pendingBranchId, setPendingBranchId] = useState(showsBranchFilter ? searchParams.get("branchId") : null);
  const selectBranch = useBranchStore((state) => state.select);
  useEffect(() => {
    if (branchReady && pendingBranchId && branchId !== pendingBranchId) selectBranch(pendingBranchId);
  }, [branchReady, branchId, pendingBranchId, selectBranch]);

  // A branch change clears the class selection during render (same idiom as below) - a class
  // from the previous branch would otherwise 404 once the class list has re-fetched. The first
  // resolution (undefined -> the auto-selected branch) and the deep link's own switch don't count.
  const [lastBranchId, setLastBranchId] = useState(branchId);
  if (branchId !== lastBranchId) {
    setLastBranchId(branchId);
    if (pendingBranchId && branchId === pendingBranchId) setPendingBranchId(null);
    else if (lastBranchId !== undefined && !pendingBranchId) setClassId("");
  }

  // Selection resets downstream state during render (the pattern `AdminResultsPanel`
  // documents) rather than in an effect; the effect below only fetches.
  const selectionKey = `${classId}|${termId}|${scope}`;
  const [lastSelectionKey, setLastSelectionKey] = useState(selectionKey);
  if (selectionKey !== lastSelectionKey) {
    setLastSelectionKey(selectionKey);
    setStudents(null);
    setLoadError(null);
    setPreviewStudentId(null);
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

  const classOptions = (classes ?? []).map((schoolClass) => ({ id: schoolClass.id, name: schoolClass.name }));

  return (
    <div className="space-y-6">
      <PageHeader title="Reports" description="Preview and download personalized result reports for a classroom." />

      {classes === null && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading classrooms…
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
          <Spinner /> Loading pupils…
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
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setPreviewStudentId(students[0].studentId)}>
              <Eye className="h-4 w-4" aria-hidden="true" /> View reports
            </Button>
          </div>
          <StudentReportList students={students} termId={termId} scope={scope} onPreview={setPreviewStudentId} />
        </>
      )}

      {previewStudentId && students && students.length > 0 && (
        <ReportPreviewNavigator
          students={students}
          termId={termId}
          scope={scope}
          studentId={previewStudentId}
          onStudentChange={setPreviewStudentId}
          onClose={() => setPreviewStudentId(null)}
        />
      )}
    </div>
  );
}

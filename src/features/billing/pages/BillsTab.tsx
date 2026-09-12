import { Download, Pencil, Receipt } from "lucide-react";
import { useEffect, useState } from "react";
import {
  type BillSummaryView,
  type BillView,
  type BranchBillingSummaryView,
  type StudentBillAdjustmentsView,
  getBillingSummary,
  getClassBills,
  getStudentBill,
  getStudentBillAdjustments,
  getStudentBillPdf,
} from "@/api/billing";
import { listClasses } from "@/api/classes";
import { ApiError } from "@/api/client";
import { can } from "@/auth/permissions";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatTile } from "@/components/ui/StatTile";
import { StickySubHeader } from "@/components/ui/StickySubHeader";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";
import { type ClassOption, ClassTermPicker } from "@/features/assessments/components/ClassTermPicker";
import { AdvanceBillPlanCard } from "@/features/billing/components/AdvanceBillPlanCard";
import { BillCard } from "@/features/billing/components/BillCard";
import { BillExportCard } from "@/features/billing/components/BillExportCard";
import { PublishBillsCard } from "@/features/billing/components/PublishBillsCard";
import { StudentBillAdjustmentsModal } from "@/features/billing/components/StudentBillAdjustmentsModal";
import { BranchFilter } from "@/features/branches/components/BranchFilter";
import { useBranchScope } from "@/features/branches/useBranchScope";
import { useAuthStore } from "@/stores/authStore";
import { useFeatureStore } from "@/stores/featureStore";
import { formatMoney } from "@/utils/currency";
import { downloadBlob } from "@/utils/download";

/** A branch's derived bills for one class + term - roster + summary. Mirrors AdminResultsPanel's shape (branch/session/term/class selection, StickySubHeader collapsible). */
export function BillsTab() {
  const { ready: branchReady, branchId } = useBranchScope();
  const role = useAuthStore((state) => state.user?.role);
  const entitled = useFeatureStore((state) => state.billing);
  const canManageAdvanceBills = can.manageAdvanceBills(role, entitled);
  const canEditStudentBills = can.editStudentBills(role, entitled);

  const [classes, setClasses] = useState<ClassOption[] | null>(null);
  const [classId, setClassId] = useState("");
  const [termId, setTermId] = useState("");

  const [summary, setSummary] = useState<BranchBillingSummaryView | null>(null);
  const [roster, setRoster] = useState<BillSummaryView[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [previewStudentId, setPreviewStudentId] = useState<string | null>(null);
  const [previewBill, setPreviewBill] = useState<BillView | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [downloadPdfError, setDownloadPdfError] = useState<string | null>(null);

  const [adjustmentsStudentId, setAdjustmentsStudentId] = useState<string | null>(null);
  const [adjustmentsView, setAdjustmentsView] = useState<StudentBillAdjustmentsView | null>(null);
  const [adjustmentsError, setAdjustmentsError] = useState<string | null>(null);

  useEffect(() => {
    if (!branchReady) return;
    listClasses(branchId, undefined, 0, 200)
      .then((page) => setClasses(page.content.map((c) => ({ id: c.id, name: c.name }))))
      .catch(() => setClasses([]));
  }, [branchReady, branchId]);

  // A branch change clears the class selection during render (the AdminResultsPanel idiom) - a
  // class from the previous branch would otherwise 404 once the class list has re-fetched.
  const [lastBranchId, setLastBranchId] = useState(branchId);
  if (branchId !== lastBranchId) {
    setLastBranchId(branchId);
    setClassId("");
  }

  const selectionKey = `${classId}|${termId}`;
  const [lastSelectionKey, setLastSelectionKey] = useState(selectionKey);
  if (selectionKey !== lastSelectionKey) {
    setLastSelectionKey(selectionKey);
    setSummary(null);
    setRoster(null);
    setLoadError(null);
  }

  useEffect(() => {
    if (!termId) return;
    getBillingSummary(termId, branchId)
      .then(setSummary)
      .catch((error: unknown) => setLoadError(error instanceof ApiError ? error.message : "Failed to load billing summary"));
    if (classId) {
      getClassBills(classId, termId)
        .then(setRoster)
        .catch((error: unknown) => setLoadError(error instanceof ApiError ? error.message : "Failed to load class bills"));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- branchId is read for the summary fetch, not a re-trigger of its own
  }, [classId, termId]);

  function openPreview(studentId: string) {
    setPreviewStudentId(studentId);
    setPreviewBill(null);
    setPreviewError(null);
    setDownloadPdfError(null);
    getStudentBill(studentId, termId)
      .then(setPreviewBill)
      .catch((error: unknown) => setPreviewError(error instanceof ApiError ? error.message : "Failed to load bill"));
  }

  function openAdjustments(studentId: string) {
    setAdjustmentsStudentId(studentId);
    setAdjustmentsView(null);
    setAdjustmentsError(null);
    getStudentBillAdjustments(studentId, termId)
      .then(setAdjustmentsView)
      .catch((error: unknown) =>
        setAdjustmentsError(error instanceof ApiError ? error.message : "Failed to load bill adjustments"),
      );
  }

  /** A save refetches the roster (its total/billable status may have changed) and, if that student's own preview is open, the preview too. */
  function refreshAfterAdjustmentsSaved() {
    if (classId) {
      getClassBills(classId, termId).then(setRoster).catch(() => undefined);
    }
    if (previewStudentId && previewStudentId === adjustmentsStudentId) {
      getStudentBill(previewStudentId, termId).then(setPreviewBill).catch(() => undefined);
    }
  }

  function downloadPdf() {
    if (!previewStudentId) return;
    setDownloadingPdf(true);
    setDownloadPdfError(null);
    getStudentBillPdf(previewStudentId, termId)
      .then((blob) => downloadBlob(blob, `${previewBill?.admissionNumber ?? previewStudentId}-bill.pdf`))
      .catch((error: unknown) =>
        setDownloadPdfError(error instanceof ApiError ? error.message : "Failed to download the bill"),
      )
      .finally(() => setDownloadingPdf(false));
  }

  const classOptions = classes ?? [];
  const showsBranchFilter = classes !== null;

  return (
    <div className="space-y-6">
      {classes === null && <Skeleton className="h-10 w-full" />}

      {classes !== null && (
        <StickySubHeader collapsible>
          <BranchFilter id="bills-branch" />
          <ClassTermPicker
            classes={classOptions}
            classId={classId}
            onClassChange={setClassId}
            termId={termId}
            onTermChange={setTermId}
          />
        </StickySubHeader>
      )}

      {canManageAdvanceBills && <AdvanceBillPlanCard branchId={branchId} />}

      {loadError && <Alert variant="error">{loadError}</Alert>}

      {!termId ? (
        showsBranchFilter && (
          <EmptyState
            icon={Receipt}
            title="Select a class and term"
            description="Pick a branch, session, term, and class to see its bills."
          />
        )
      ) : (
        <>
          {summary ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <StatTile
                label="Billable students"
                value={summary.byLevel.reduce((sum, level) => sum + level.billableStudentCount, 0)}
              />
              <StatTile
                label="Expected compulsory revenue"
                value={formatMoney(summary.totalExpectedRevenue, summary.currency)}
              />
              <StatTile label="Currency" value={summary.currency} />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          )}

          {classId &&
            (roster === null ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : roster.length === 0 ? (
              <EmptyState icon={Receipt} title="No students on this class's roster" />
            ) : (
              <Table>
                <TableHead>
                  <TableRow>
                    <TableHeaderCell>Student</TableHeaderCell>
                    <TableHeaderCell>Admission no.</TableHeaderCell>
                    <TableHeaderCell>Status</TableHeaderCell>
                    <TableHeaderCell numeric>Total</TableHeaderCell>
                    {canEditStudentBills && <TableHeaderCell>{/* Edit bill */}</TableHeaderCell>}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {roster.map((row) => (
                    <TableRow key={row.studentId} onClick={() => openPreview(row.studentId)}>
                      <TableCell label="Student">{row.studentName}</TableCell>
                      <TableCell label="Admission no.">{row.admissionNumber}</TableCell>
                      <TableCell label="Status">
                        <div className="flex flex-wrap gap-1">
                          <Badge variant={row.billable ? "success" : "neutral"}>
                            {row.billable ? "Billed" : "No bill"}
                          </Badge>
                          {row.advance && <Badge variant="info">Advance</Badge>}
                        </div>
                      </TableCell>
                      <TableCell label="Total" numeric>
                        {row.billable ? formatMoney(row.total, row.currency) : "—"}
                      </TableCell>
                      {canEditStudentBills && (
                        <TableCell label="Edit bill">
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={(event) => {
                              event.stopPropagation();
                              openAdjustments(row.studentId);
                            }}
                          >
                            <Pencil className="h-4 w-4" aria-hidden="true" /> Edit bill
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ))}

          <PublishBillsCard branchId={branchId} termId={termId} currency={summary?.currency} />

          {classId && <BillExportCard classId={classId} termId={termId} />}
        </>
      )}

      <Modal open={previewStudentId !== null} onClose={() => setPreviewStudentId(null)} title="Bill preview" size="xl">
        {previewError && <Alert variant="error">{previewError}</Alert>}
        {!previewError && !previewBill && <Skeleton className="h-40 w-full" />}
        {previewBill && (
          <div className="space-y-4">
            <BillCard bill={previewBill} />
            {downloadPdfError && <Alert variant="error">{downloadPdfError}</Alert>}
            <Button variant="secondary" onClick={downloadPdf} loading={downloadingPdf}>
              <Download className="h-4 w-4" aria-hidden="true" /> Download PDF
            </Button>
          </div>
        )}
      </Modal>

      {adjustmentsStudentId && !adjustmentsView && (
        <Modal open onClose={() => setAdjustmentsStudentId(null)} title="Edit bill" size="xl">
          {adjustmentsError && <Alert variant="error">{adjustmentsError}</Alert>}
          {!adjustmentsError && <Skeleton className="h-40 w-full" />}
        </Modal>
      )}
      {adjustmentsStudentId && adjustmentsView && (
        <StudentBillAdjustmentsModal
          studentId={adjustmentsStudentId}
          termId={termId}
          view={adjustmentsView}
          onClose={() => setAdjustmentsStudentId(null)}
          onSaved={refreshAfterAdjustmentsSaved}
        />
      )}
    </div>
  );
}

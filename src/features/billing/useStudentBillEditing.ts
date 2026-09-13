import { useState } from "react";
import {
  type BillView,
  type StudentBillAdjustmentsView,
  getStudentBill,
  getStudentBillAdjustments,
  getStudentBillPdf,
} from "@/api/billing";
import { ApiError } from "@/api/client";
import { downloadBlob } from "@/utils/download";

/**
 * Owns one student's bill-preview and bill-adjustments modal state for one term - the state and
 * fetch/refresh logic `BillsTab`'s roster and `AdvanceBillsTab`'s "Bills to be generated" roster
 * both need identically (Phase 28), extracted once there were two consumers of the same ~70 lines.
 * Pair with `StudentBillModals`, which renders the two modals from this hook's own state.
 * <p>
 * `onSaved` is called after a successful adjustments save, once this hook has already refetched
 * the open preview (if it's the same student's) itself - the caller only needs to refresh whatever
 * roster/summary it owns, the same as `BillsTab`'s pre-extraction `refreshAfterAdjustmentsSaved`.
 */
export function useStudentBillEditing(termId: string, onSaved: () => void) {
  const [previewStudentId, setPreviewStudentId] = useState<string | null>(null);
  const [previewBill, setPreviewBill] = useState<BillView | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [downloadPdfError, setDownloadPdfError] = useState<string | null>(null);

  const [adjustmentsStudentId, setAdjustmentsStudentId] = useState<string | null>(null);
  const [adjustmentsView, setAdjustmentsView] = useState<StudentBillAdjustmentsView | null>(null);
  const [adjustmentsError, setAdjustmentsError] = useState<string | null>(null);

  function openPreview(studentId: string) {
    setPreviewStudentId(studentId);
    setPreviewBill(null);
    setPreviewError(null);
    setDownloadPdfError(null);
    getStudentBill(studentId, termId)
      .then(setPreviewBill)
      .catch((error: unknown) => setPreviewError(error instanceof ApiError ? error.message : "Failed to load bill"));
  }

  function closePreview() {
    setPreviewStudentId(null);
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

  function closeAdjustments() {
    setAdjustmentsStudentId(null);
  }

  /** A save refetches this same student's own open preview (its total/billable status may have changed), then defers to the caller's own roster refresh. */
  function handleAdjustmentsSaved() {
    if (previewStudentId && previewStudentId === adjustmentsStudentId) {
      getStudentBill(previewStudentId, termId).then(setPreviewBill).catch(() => undefined);
    }
    onSaved();
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

  return {
    previewStudentId,
    previewBill,
    previewError,
    downloadingPdf,
    downloadPdfError,
    openPreview,
    closePreview,
    downloadPdf,
    adjustmentsStudentId,
    adjustmentsView,
    adjustmentsError,
    openAdjustments,
    closeAdjustments,
    handleAdjustmentsSaved,
  };
}

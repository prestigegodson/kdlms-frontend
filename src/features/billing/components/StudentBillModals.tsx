import { Download } from "lucide-react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { BillCard } from "@/features/billing/components/BillCard";
import { StudentBillAdjustmentsModal } from "@/features/billing/components/StudentBillAdjustmentsModal";
import type { useStudentBillEditing } from "@/features/billing/useStudentBillEditing";

interface StudentBillModalsProps {
  termId: string;
  editing: ReturnType<typeof useStudentBillEditing>;
}

/**
 * Renders the bill-preview modal and the bill-adjustments modal a `useStudentBillEditing` hook
 * owns - `BillsTab`'s roster and `AdvanceBillsTab`'s "Bills to be generated" roster both mount
 * this identically (Phase 28), so the two modals' markup lives in exactly one place.
 */
export function StudentBillModals({ termId, editing }: StudentBillModalsProps) {
  const {
    previewStudentId,
    previewBill,
    previewError,
    downloadingPdf,
    downloadPdfError,
    closePreview,
    downloadPdf,
    adjustmentsStudentId,
    adjustmentsView,
    adjustmentsError,
    closeAdjustments,
    handleAdjustmentsSaved,
  } = editing;

  return (
    <>
      <Modal open={previewStudentId !== null} onClose={closePreview} title="Bill preview" size="xl">
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
        <Modal open onClose={closeAdjustments} title="Edit bill" size="xl">
          {adjustmentsError && <Alert variant="error">{adjustmentsError}</Alert>}
          {!adjustmentsError && <Skeleton className="h-40 w-full" />}
        </Modal>
      )}
      {adjustmentsStudentId && adjustmentsView && (
        <StudentBillAdjustmentsModal
          studentId={adjustmentsStudentId}
          termId={termId}
          view={adjustmentsView}
          onClose={closeAdjustments}
          onSaved={handleAdjustmentsSaved}
        />
      )}
    </>
  );
}

import { Download } from "lucide-react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { BillCard } from "@/features/billing/components/BillCard";
import { StudentBillAdjustmentsModal } from "@/features/billing/components/StudentBillAdjustmentsModal";
import { StudentPaymentsSection } from "@/features/billing/components/payments/StudentPaymentsSection";
import type { useStudentBillEditing } from "@/features/billing/useStudentBillEditing";
import { can } from "@/auth/permissions";
import { useAuthStore } from "@/stores/authStore";
import { useFeatureStore } from "@/stores/featureStore";

interface StudentBillModalsProps {
  termId: string;
  editing: ReturnType<typeof useStudentBillEditing>;
  /** The roster's branch - where Record payment's student search starts. */
  branchId?: string;
  /** Called after a payment is recorded/voided/corrected from the preview, so the roster refreshes. */
  onPaymentsChanged?: () => void;
}

/**
 * Renders the bill-preview modal and the bill-adjustments modal a `useStudentBillEditing` hook
 * owns - `BillsTab`'s roster and `AdvanceBillsTab`'s "Bills to be generated" roster both mount
 * this identically (Phase 28), so the two modals' markup lives in exactly one place.
 */
export function StudentBillModals({ termId, editing, branchId, onPaymentsChanged }: StudentBillModalsProps) {
  const role = useAuthStore((state) => state.user?.role);
  const entitled = useFeatureStore((state) => state.billing);
  const canManagePayments = can.manageFeePayments(role, entitled);
  const {
    previewStudentId,
    previewStudent,
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
        <div className="space-y-4">
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
          {/* Shown even without a bill - an amount-only payment (D2) still belongs to the student. */}
          {canManagePayments && previewStudentId && termId && (previewBill || previewStudent) && (
            <StudentPaymentsSection
              student={{
                id: previewStudentId,
                name: previewBill?.studentName ?? previewStudent!.name,
                admissionNumber: previewBill?.admissionNumber ?? previewStudent!.admissionNumber,
              }}
              termId={termId}
              branchId={branchId}
              onChanged={() => onPaymentsChanged?.()}
            />
          )}
        </div>
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

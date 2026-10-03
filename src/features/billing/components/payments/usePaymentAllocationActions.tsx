import { useState } from "react";
import type { AllocationView, StaffFeePaymentView } from "@/api/staffFeePayments";
import { correctConfirmedAmount, voidAllocation } from "@/api/staffFeePayments";
import { CorrectAmountDialog } from "@/features/billing/components/payments/CorrectAmountDialog";
import { ReasonDialog } from "@/features/billing/components/payments/ReasonDialog";
import { usePendingFeePaymentsStore } from "@/stores/pendingFeePaymentsStore";

/**
 * The Void / Correct amount dialogs for a confirmed child (D11), shared by the review modal and
 * a student's payments section. `onDone` gets the updated payment so the caller can refresh.
 */
export function usePaymentAllocationActions(onDone: (view: StaffFeePaymentView) => void) {
  const [voiding, setVoiding] = useState<AllocationView | null>(null);
  const [correcting, setCorrecting] = useState<{
    allocation: AllocationView;
    currency: string;
  } | null>(null);
  const refreshPending = usePendingFeePaymentsStore((state) => state.refresh);

  const dialogs = (
    <>
      {voiding && (
        <ReasonDialog
          title="Void payment"
          message={`Void ${voiding.studentName}'s confirmed payment? Its receipt is marked VOID and the term status reverts. Any optional fee it added stays on the bill.`}
          confirmLabel="Void payment"
          onConfirm={async (reason) => {
            const view = await voidAllocation(voiding.id, reason);
            setVoiding(null);
            refreshPending();
            onDone(view);
          }}
          onClose={() => setVoiding(null)}
        />
      )}
      {correcting && (
        <CorrectAmountDialog
          allocation={correcting.allocation}
          currency={correcting.currency}
          onConfirm={async (body) => {
            const view = await correctConfirmedAmount(correcting.allocation.id, body);
            setCorrecting(null);
            onDone(view);
          }}
          onClose={() => setCorrecting(null)}
        />
      )}
    </>
  );

  return {
    openVoid: (allocation: AllocationView) => setVoiding(allocation),
    openCorrect: (allocation: AllocationView, currency: string) =>
      setCorrecting({ allocation, currency }),
    dialogs,
  };
}

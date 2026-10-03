import type { BillView } from "@/api/billing";
import type { Settlement } from "@/api/feePayments";
import type { StaffPaymentRequest, TermStatusView } from "@/api/staffFeePayments";
import {
  parseAmount,
  toMinorUnits,
} from "@/features/billing/components/paymentForm/paymentAmounts";
import {
  type ChildDrafts,
  childRequests,
  type PaymentChildOption,
  selectedOptions,
  totalMinor,
} from "@/features/billing/components/paymentForm/paymentChildren";
import type { PaymentDetails } from "@/features/billing/components/paymentForm/paymentDetails";
import { suggestSettlement } from "@/features/billing/components/payments/reviewDraft";

/**
 * The admin's Record payment form (Phase 45I, D12) - the same children/amounts/optional-fees
 * drafts as the guardian sheet, plus a per-child settlement for "Record & confirm".
 */

/** A searched-and-added student as a children-step row, carrying what the settlement suggestion needs. */
export interface RecordChildOption extends PaymentChildOption {
  admissionNumber: string;
  billedMinor: number | null;
  confirmedPaidMinor: number;
}

/**
 * A student added to the payment: their live term status (from the ledger) and their bill's
 * unselected optional fees (none when they have no bill). Unlike a guardian, an admin may record
 * against a paid-in-full term (D6) - it's flagged, never disabled.
 */
export function recordChildOption(
  student: { id: string; name: string; admissionNumber: string },
  status: TermStatusView,
  bill: BillView | null,
): RecordChildOption {
  let outstandingMinor: number | null = null;
  if (status.balance !== null) {
    outstandingMinor = Math.max(
      toMinorUnits(status.balance) - toMinorUnits(status.pendingAmount),
      0,
    );
  }
  return {
    studentId: student.id,
    name: student.name,
    admissionNumber: student.admissionNumber,
    groupLabel: "",
    disabledReason: null,
    warning:
      status.state === "PAID_IN_FULL"
        ? "Already paid in full for this term - this is recorded as an extra payment"
        : null,
    balance: status.balance,
    outstandingMinor,
    optionalFees: (bill?.optionalLines ?? [])
      .filter((line): line is typeof line & { feeId: string } => line.feeId !== null)
      .map((line) => ({ feeId: line.feeId, feeName: line.feeName, amount: line.amount })),
    billedMinor: status.billed === null ? null : toMinorUnits(status.billed),
    confirmedPaidMinor: toMinorUnits(status.confirmedPaid),
  };
}

/** What confirming this child's draft now would settle as - its ticked optional fees join the bill (D8). */
export function recordSuggestion(option: RecordChildOption, drafts: ChildDrafts): Settlement {
  const draft = drafts[option.studentId];
  const ticked = new Set(draft?.optionalFeeIds ?? []);
  const added = option.optionalFees
    .filter((fee) => ticked.has(fee.feeId))
    .reduce((sum, fee) => sum + toMinorUnits(fee.amount), 0);
  const billMinor = option.billedMinor === null ? null : option.billedMinor + added;
  return suggestSettlement(
    billMinor,
    option.confirmedPaidMinor + (parseAmount(draft?.amountText ?? "") ?? 0),
  );
}

export function buildStaffRequest(
  termId: string,
  options: RecordChildOption[],
  drafts: ChildDrafts,
  details: PaymentDetails,
  confirmNow: boolean,
  settlements: Record<string, Settlement>,
): StaffPaymentRequest {
  const byId = new Map(
    selectedOptions(options, drafts).map((option) => [option.studentId, option]),
  );
  return {
    termId,
    payerName: details.payerName.trim(),
    paymentDate: details.paymentDate,
    method: details.method ?? "OTHER",
    note: details.note.trim() === "" ? null : details.note.trim(),
    totalAmount: totalMinor(options, drafts) / 100,
    confirmNow,
    children: childRequests(options, drafts).map((child) => ({
      ...child,
      settlement: confirmNow
        ? (settlements[child.studentId] ?? recordSuggestion(byId.get(child.studentId)!, drafts))
        : null,
    })),
  };
}

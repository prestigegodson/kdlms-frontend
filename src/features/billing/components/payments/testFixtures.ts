import type {
  AllocationView,
  StaffFeePaymentView,
  StudentPaymentLedgerView,
  TermStatusView,
} from "@/api/staffFeePayments";

/** Test fixtures for the staff fee-payment views (Phase 45I) - not imported by app code. */

export function termStatus(overrides: Partial<TermStatusView> = {}): TermStatusView {
  return {
    state: "PENDING_CONFIRMATION",
    billed: 50000,
    confirmedPaid: 0,
    pendingAmount: 20000,
    balance: 50000,
    hasPending: true,
    inCredit: false,
    ...overrides,
  };
}

export function allocation(overrides: Partial<AllocationView> = {}): AllocationView {
  return {
    id: "alloc-1",
    version: 3,
    studentId: "student-1",
    studentName: "Ada Obi",
    admissionNumber: "SCH/2026/0001",
    className: "Primary 1A",
    branchId: "branch-1",
    status: "PENDING",
    claimedAmount: 20000,
    confirmedAmount: null,
    settlement: null,
    suggestedSettlement: "PARTIAL",
    settlementMismatch: false,
    reason: null,
    reviewedAt: null,
    optionalFees: [],
    bill: {
      billReference: "SCH/2026/0001-T1",
      total: 50000,
      published: true,
      tickableOptionalFees: [],
    },
    termStatus: termStatus(),
    receipts: [],
    ...overrides,
  };
}

export function paymentView(overrides: Partial<StaffFeePaymentView> = {}): StaffFeePaymentView {
  return {
    id: "payment-1",
    termId: "term-1",
    termName: "First Term",
    sessionId: "session-1",
    source: "GUARDIAN",
    submittedBy: "guardian-1",
    payerName: "Gina Obi",
    paymentDate: "2026-09-20",
    method: "BANK_TRANSFER",
    note: null,
    totalAmount: 20000,
    currency: "NGN",
    status: "PENDING",
    createdAt: "2026-09-20T10:00:00Z",
    attachments: [],
    hiddenAllocationCount: 0,
    allocations: [allocation()],
    ...overrides,
  };
}

export function ledger(
  overrides: Partial<StudentPaymentLedgerView> = {},
): StudentPaymentLedgerView {
  return {
    studentId: "student-1",
    currency: "NGN",
    terms: [
      {
        termId: "term-1",
        termName: "First Term",
        termNumber: 1,
        sessionId: "session-1",
        status: termStatus({
          state: "PART_PAID",
          confirmedPaid: 20000,
          pendingAmount: 0,
          balance: 30000,
          hasPending: false,
        }),
        payments: [
          {
            paymentId: "payment-1",
            paymentDate: "2026-09-20",
            method: "BANK_TRANSFER",
            payerName: "Gina Obi",
            source: "GUARDIAN",
            childCount: 1,
            allocation: allocation({
              status: "CONFIRMED",
              confirmedAmount: 20000,
              settlement: "PARTIAL",
              receipts: [
                {
                  receiptId: "receipt-1",
                  receiptNumber: "RCT/2026/00001",
                  status: "ISSUED",
                  issuedAt: "2026-09-21T10:00:00Z",
                  voidedAt: null,
                  voidReason: null,
                  supersededBy: null,
                },
              ],
            }),
          },
        ],
      },
    ],
    ...overrides,
  };
}

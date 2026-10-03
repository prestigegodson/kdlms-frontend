import { apiFetch, apiFetchBlob, apiUploadWithProgress, type UploadProgress } from "@/api/client";
import {
  type AllocationStatus,
  type CombinedPaymentStatus,
  type PaymentMethod,
  type PaymentSource,
  paymentFormData,
  type ReceiptStatus,
  type Settlement,
  type TermPaymentState,
} from "@/api/feePayments";

/**
 * A SCHOOL_ADMIN/BRANCH_ADMIN's view of school-fees payments (Phase 45I) - the review queue,
 * reviewing/recording/voiding/correcting a payment, a student's payment ledger, the collection
 * summary and the CSV export. Mirrors backend billing.adapter.in.web.FeePaymentController; a
 * BRANCH_ADMIN only ever sees its own branch's allocations (anything else is a 404).
 */

export type ReviewAction = "CONFIRM" | "REJECT";

/** Mirrors backend StaffFeePaymentView.OptionalFeeView - `applied` once a confirm opted the child in. */
export interface StaffOptionalFeeView {
  feeId: string;
  feeName: string;
  amount: number;
  applied: boolean;
}

/** Mirrors backend StaffFeePaymentView.BillSummary - the child's live bill; null on the allocation when it has none. */
export interface StaffBillSummary {
  billReference: string;
  total: number;
  published: boolean;
  tickableOptionalFees: StaffOptionalFeeView[];
}

/**
 * Mirrors backend StaffFeePaymentView.TermStatusView - the child's whole term across every
 * payment. `billed`/`balance` are null with no bill; a negative balance is a credit.
 */
export interface TermStatusView {
  state: TermPaymentState;
  billed: number | null;
  confirmedPaid: number;
  pendingAmount: number;
  balance: number | null;
  hasPending: boolean;
  inCredit: boolean;
}

export interface StaffAttachmentView {
  fileId: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
}

export interface StaffReceiptView {
  receiptId: string;
  receiptNumber: string;
  status: ReceiptStatus;
  issuedAt: string;
  voidedAt: string | null;
  voidReason: string | null;
  supersededBy: string | null;
}

/**
 * Mirrors backend StaffFeePaymentView.AllocationView - one child's share. `suggestedSettlement`
 * is what confirming the claim in full would settle as (PENDING), or what it settles as now
 * (CONFIRMED); `settlementMismatch` is a warning only - the admin's choice always wins (D5).
 */
export interface AllocationView {
  id: string;
  version: number;
  studentId: string;
  studentName: string;
  admissionNumber: string;
  className: string | null;
  branchId: string;
  status: AllocationStatus;
  claimedAmount: number;
  confirmedAmount: number | null;
  settlement: Settlement | null;
  suggestedSettlement: Settlement | null;
  settlementMismatch: boolean;
  reason: string | null;
  reviewedAt: string | null;
  optionalFees: StaffOptionalFeeView[];
  bill: StaffBillSummary | null;
  termStatus: TermStatusView;
  receipts: StaffReceiptView[];
}

/** Mirrors backend StaffFeePaymentView - the detail, and every write's response. */
export interface StaffFeePaymentView {
  id: string;
  termId: string;
  termName: string;
  sessionId: string;
  source: PaymentSource;
  submittedBy: string;
  payerName: string;
  paymentDate: string;
  method: PaymentMethod;
  note: string | null;
  totalAmount: number;
  currency: string;
  status: CombinedPaymentStatus;
  createdAt: string;
  attachments: StaffAttachmentView[];
  /** Allocations in branches the caller can't see (BRANCH_ADMIN) - left out of `allocations`. */
  hiddenAllocationCount: number;
  allocations: AllocationView[];
}

export interface QueueAllocation {
  allocationId: string;
  version: number;
  studentId: string;
  studentName: string;
  admissionNumber: string;
  className: string | null;
  branchId: string;
  branchName: string | null;
  status: AllocationStatus;
  claimedAmount: number;
  confirmedAmount: number | null;
  settlement: Settlement | null;
  reason: string | null;
  reviewedAt: string | null;
  receiptId: string | null;
  receiptNumber: string | null;
  possibleDuplicate: boolean;
}

export interface QueueItem {
  paymentId: string;
  termId: string;
  termName: string;
  source: PaymentSource;
  payerName: string;
  paymentDate: string;
  method: PaymentMethod;
  totalAmount: number;
  currency: string;
  status: CombinedPaymentStatus;
  createdAt: string;
  attachmentCount: number;
  hiddenAllocationCount: number;
  allocations: QueueAllocation[];
}

/** Paged over payments (never splitting one across pages), newest first. */
export interface PaymentQueuePage {
  items: QueueItem[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface LedgerEntry {
  paymentId: string;
  paymentDate: string;
  method: PaymentMethod;
  payerName: string;
  source: PaymentSource;
  childCount: number;
  allocation: AllocationView;
}

export interface TermLedger {
  termId: string;
  termName: string;
  termNumber: number;
  sessionId: string;
  status: TermStatusView;
  payments: LedgerEntry[];
}

export interface StudentPaymentLedgerView {
  studentId: string;
  currency: string;
  terms: TermLedger[];
}

export interface CollectionTotals {
  billed: number;
  confirmed: number;
  outstanding: number;
  pending: number;
  credit: number;
  students: number;
  billableStudents: number;
  studentsByState: Partial<Record<TermPaymentState, number>>;
}

export interface CollectionSummaryView {
  branchId: string;
  branchName: string;
  termId: string;
  termName: string;
  currency: string;
  totals: CollectionTotals;
  byLevel: { levelId: string; levelName: string; totals: CollectionTotals }[];
}

export interface StaffChildRequest {
  studentId: string;
  amount: number;
  optionalFeeIds: string[];
  /** Required when the payment is recorded with `confirmNow`. */
  settlement: Settlement | null;
}

export interface StaffPaymentRequest {
  termId: string;
  payerName: string;
  paymentDate: string;
  method: PaymentMethod;
  note: string | null;
  totalAmount: number;
  children: StaffChildRequest[];
  /** "Record & confirm" (true) vs "Save as pending" (false) - D12. */
  confirmNow: boolean;
  /** Read on edit only. */
  keepAttachmentFileIds?: string[];
}

export interface ReviewItemRequest {
  allocationId: string;
  version: number;
  action: ReviewAction;
  confirmedAmount: number | null;
  settlement: Settlement | null;
  /** The final set of optional fees to opt the child into on confirm. */
  optionalFeeIds: string[];
  reason: string | null;
}

export interface PaymentQueueFilters {
  branchId?: string;
  termId?: string;
  levelId?: string;
  status?: AllocationStatus;
  method?: PaymentMethod;
  from?: string;
  to?: string;
  q?: string;
}

const BASE = "/api/v1/billing";

function filterParams(filters: PaymentQueueFilters): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value);
  }
  return params;
}

export function listFeePayments(
  filters: PaymentQueueFilters,
  page = 0,
  size = 20,
): Promise<PaymentQueuePage> {
  const params = filterParams(filters);
  params.set("page", String(page));
  params.set("size", String(size));
  return apiFetch<PaymentQueuePage>(`${BASE}/payments?${params}`);
}

/** Pending children (not payments) - school-wide for a SCHOOL_ADMIN with no branch. */
export function getPendingPaymentCount(branchId?: string): Promise<{ count: number }> {
  const params = new URLSearchParams();
  if (branchId) params.set("branchId", branchId);
  const query = params.toString();
  return apiFetch<{ count: number }>(`${BASE}/payments/pending-count${query ? `?${query}` : ""}`);
}

export function getFeePayment(paymentId: string): Promise<StaffFeePaymentView> {
  return apiFetch<StaffFeePaymentView>(`${BASE}/payments/${paymentId}`);
}

/** Records a payment on a guardian's behalf - proof is optional for staff (D14). */
export function recordFeePayment(
  request: StaffPaymentRequest,
  files: File[],
  onProgress?: (progress: UploadProgress) => void,
): Promise<StaffFeePaymentView> {
  return apiUploadWithProgress<StaffFeePaymentView>(
    `${BASE}/payments`,
    "POST",
    paymentFormData(request, files),
    onProgress,
  );
}

export function editStaffFeePayment(
  paymentId: string,
  request: StaffPaymentRequest,
  files: File[],
  onProgress?: (progress: UploadProgress) => void,
): Promise<StaffFeePaymentView> {
  return apiUploadWithProgress<StaffFeePaymentView>(
    `${BASE}/payments/${paymentId}`,
    "PUT",
    paymentFormData(request, files),
    onProgress,
  );
}

/** Confirms/rejects children of one payment - a stale `version` on any of them is a 409. */
export function reviewFeePayment(
  paymentId: string,
  items: ReviewItemRequest[],
): Promise<StaffFeePaymentView> {
  return apiFetch<StaffFeePaymentView>(`${BASE}/payments/${paymentId}/review`, {
    method: "POST",
    body: JSON.stringify({ items }),
  });
}

export function voidAllocation(allocationId: string, reason: string): Promise<StaffFeePaymentView> {
  return apiFetch<StaffFeePaymentView>(`${BASE}/payment-allocations/${allocationId}/void`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

/** Voids the current receipt and issues a new one for the corrected amount. */
export function correctConfirmedAmount(
  allocationId: string,
  body: { amount: number; settlement: Settlement; reason: string },
): Promise<StaffFeePaymentView> {
  return apiFetch<StaffFeePaymentView>(
    `${BASE}/payment-allocations/${allocationId}/confirmed-amount`,
    {
      method: "PUT",
      body: JSON.stringify(body),
    },
  );
}

/** One student's payments - every term they have one in, or just `termId`'s. */
export function getStudentPaymentLedger(
  studentId: string,
  termId?: string,
): Promise<StudentPaymentLedgerView> {
  const params = new URLSearchParams();
  if (termId) params.set("termId", termId);
  const query = params.toString();
  return apiFetch<StudentPaymentLedgerView>(
    `${BASE}/students/${studentId}/payments${query ? `?${query}` : ""}`,
  );
}

/** `branchId` is required for a SCHOOL_ADMIN, derived server-side for a BRANCH_ADMIN. */
export function getCollectionSummary(
  termId: string,
  branchId?: string,
): Promise<CollectionSummaryView> {
  const params = new URLSearchParams({ termId });
  if (branchId) params.set("branchId", branchId);
  return apiFetch<CollectionSummaryView>(`${BASE}/payments/summary?${params}`);
}

export function exportFeePaymentsCsv(filters: PaymentQueueFilters): Promise<Blob> {
  const query = filterParams(filters).toString();
  return apiFetchBlob(`${BASE}/payments/export.csv${query ? `?${query}` : ""}`);
}

export function downloadStaffPaymentAttachment(paymentId: string, fileId: string): Promise<Blob> {
  return apiFetchBlob(`${BASE}/payments/${paymentId}/attachments/${fileId}`);
}

export function downloadStaffReceiptPdf(receiptId: string): Promise<Blob> {
  return apiFetchBlob(`${BASE}/fee-receipts/${receiptId}/pdf`);
}

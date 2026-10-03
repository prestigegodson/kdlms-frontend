import { apiFetch, apiFetchBlob, apiUploadWithProgress, type UploadProgress } from "@/api/client";

/**
 * A GUARDIAN's school-fees payments (Phase 45) - the per-term Fees cards, logging/editing/
 * withdrawing a payment with proof attached, and downloading that proof and the issued receipts.
 * Mirrors backend billing.adapter.in.web.MyWardFeesController and MyFeePaymentsController.
 */

/** Mirrors backend billing.domain.TermPaymentStatus.State. */
export type TermPaymentState = "UNPAID" | "PENDING_CONFIRMATION" | "PART_PAID" | "PAID_IN_FULL";

/** Mirrors backend billing.domain.AllocationStatus - one child's share of a submission. */
export type AllocationStatus = "PENDING" | "CONFIRMED" | "REJECTED" | "WITHDRAWN" | "VOIDED";

/** Mirrors backend billing.domain.Settlement - only set on a CONFIRMED allocation. */
export type Settlement = "PARTIAL" | "FULL";

/** Mirrors backend billing.domain.PaymentMethod. */
export type PaymentMethod = "BANK_TRANSFER" | "BANK_DEPOSIT" | "POS" | "CASH" | "CHEQUE" | "OTHER";

/** Mirrors backend billing.domain.PaymentSource - who logged the payment. */
export type PaymentSource = "GUARDIAN" | "STAFF";

/** Mirrors backend billing.domain.ReceiptStatus. */
export type ReceiptStatus = "ISSUED" | "VOID";

/** Mirrors backend billing.domain.FeePayment.CombinedStatus - a whole submission's state across its children. */
export type CombinedPaymentStatus =
  | "PENDING"
  | "PARTIALLY_REVIEWED"
  | "CONFIRMED"
  | "REJECTED"
  | "WITHDRAWN"
  | "VOIDED"
  | "MIXED";

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  BANK_TRANSFER: "Bank transfer",
  BANK_DEPOSIT: "Bank deposit",
  POS: "POS",
  CASH: "Cash",
  CHEQUE: "Cheque",
  OTHER: "Other",
};

/** Mirrors backend WardFeeTermView.OptionalFeeView. */
export interface OptionalFeeView {
  feeId: string;
  feeName: string;
  amount: number;
}

/** Mirrors backend WardFeeTermView.AttachmentView. */
export interface PaymentAttachmentView {
  fileId: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
}

/** Mirrors backend WardFeeTermView.ReceiptView. */
export interface FeeReceiptView {
  receiptId: string;
  receiptNumber: string;
  status: ReceiptStatus;
  issuedAt: string;
}

/**
 * Mirrors backend WardFeeTermView.PaymentView - this ward's own share of one submission.
 * `totalAmount`/`childCount` describe the whole submission (it may also cover siblings);
 * `canEdit` is true only for the submitter while every child on it is still pending.
 */
export interface WardFeePaymentView {
  paymentId: string;
  allocationId: string;
  status: AllocationStatus;
  claimedAmount: number;
  confirmedAmount: number | null;
  settlement: Settlement | null;
  reason: string | null;
  paymentDate: string;
  method: PaymentMethod;
  payerName: string;
  note: string | null;
  totalAmount: number;
  childCount: number;
  submittedAt: string;
  submittedByMe: boolean;
  canEdit: boolean;
  optionalFees: OptionalFeeView[];
  attachments: PaymentAttachmentView[];
  receipts: FeeReceiptView[];
}

/**
 * Mirrors backend billing.application.port.in.WardFeeTermView - one term card. `billed`/`balance`
 * are null when the term has no published, billable bill (amount-only payments are still allowed);
 * a negative `balance` is a credit. `canLogPayment` is false once the term is paid in full.
 */
export interface WardFeeTermView {
  sessionId: string;
  sessionName: string;
  termId: string;
  termName: string;
  termNumber: number;
  current: boolean;
  advance: boolean;
  published: boolean;
  billReference: string | null;
  currency: string;
  billed: number | null;
  confirmedPaid: number;
  pendingAmount: number;
  balance: number | null;
  status: TermPaymentState;
  hasPending: boolean;
  inCredit: boolean;
  canLogPayment: boolean;
  optionalFees: OptionalFeeView[];
  payments: WardFeePaymentView[];
}

/** One child on a submission - mirrors backend MyFeePaymentsController.ChildRequest. */
export interface PaymentChildRequest {
  studentId: string;
  amount: number;
  optionalFeeIds: string[];
}

/** Mirrors backend MyFeePaymentsController.PaymentRequest. `keepAttachmentFileIds` is read on edit only. */
export interface PaymentRequest {
  termId: string;
  payerName: string;
  paymentDate: string;
  method: PaymentMethod;
  note: string | null;
  totalAmount: number;
  children: PaymentChildRequest[];
  keepAttachmentFileIds?: string[];
}

/** Mirrors backend billing.application.port.in.FeePaymentView - the submit/edit response. */
export interface FeePaymentView {
  id: string;
  termId: string;
  payerName: string;
  paymentDate: string;
  method: PaymentMethod;
  note: string | null;
  totalAmount: number;
  currency: string;
  status: CombinedPaymentStatus;
  attachmentFileIds: string[];
  allocations: {
    id: string;
    studentId: string;
    claimedAmount: number;
    status: AllocationStatus;
    optionalFeeIds: string[];
  }[];
}

const ME = "/api/v1/me";

/** One card per eligible term for a ward, newest first. */
export function getWardFees(studentId: string): Promise<WardFeeTermView[]> {
  return apiFetch<WardFeeTermView[]>(`${ME}/wards/${studentId}/fees`);
}

/**
 * The backend reads the request as a `@RequestPart("payment")`, which only binds JSON when the
 * part itself declares `application/json` - hence a typed Blob rather than a plain string field.
 */
export function paymentFormData(request: object, files: File[]): FormData {
  const formData = new FormData();
  formData.append("payment", new Blob([JSON.stringify(request)], { type: "application/json" }));
  for (const file of files) {
    formData.append("files", file);
  }
  return formData;
}

/**
 * Logs a payment for one or more wards at the same school - proof (1–3 files) is required.
 * `onProgress` reports the multipart upload as it goes (the proof photos can be a few MB on a
 * slow connection).
 */
export function submitFeePayment(
  request: PaymentRequest,
  files: File[],
  onProgress?: (progress: UploadProgress) => void,
): Promise<FeePaymentView> {
  return apiUploadWithProgress<FeePaymentView>(`${ME}/fee-payments`, "POST", paymentFormData(request, files), onProgress);
}

/** Full-replaces a still-pending submission - submitter only; `files` are added alongside the kept attachments. */
export function editFeePayment(
  paymentId: string,
  request: PaymentRequest,
  files: File[],
  onProgress?: (progress: UploadProgress) => void,
): Promise<FeePaymentView> {
  return apiUploadWithProgress<FeePaymentView>(
    `${ME}/fee-payments/${paymentId}`,
    "PUT",
    paymentFormData(request, files),
    onProgress,
  );
}

/** Withdraws a still-pending submission and deletes its proof - submitter only. */
export function withdrawFeePayment(paymentId: string): Promise<void> {
  return apiFetch<void>(`${ME}/fee-payments/${paymentId}/withdraw`, { method: "POST" });
}

export function downloadFeePaymentAttachment(paymentId: string, fileId: string): Promise<Blob> {
  return apiFetchBlob(`${ME}/fee-payments/${paymentId}/attachments/${fileId}`);
}

export function downloadFeeReceiptPdf(receiptId: string): Promise<Blob> {
  return apiFetchBlob(`${ME}/fee-receipts/${receiptId}/pdf`);
}

import { PAYMENT_METHOD_LABELS, type PaymentMethod } from "@/api/feePayments";
import { todayIso } from "@/utils/date";

/** The when/how/who of a fee payment (D13), as edited by `PaymentDetailsFields`. */
export interface PaymentDetails {
  paymentDate: string;
  method: PaymentMethod | null;
  payerName: string;
  note: string;
}

export const PAYMENT_METHODS = Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[];

/** Mirrors the backend's own checks (FeePayment#requireDetails) - the date can't be in the future. */
export function paymentDetailsValid(details: PaymentDetails): boolean {
  return (
    details.paymentDate !== "" &&
    details.paymentDate <= todayIso() &&
    details.method !== null &&
    details.payerName.trim() !== ""
  );
}

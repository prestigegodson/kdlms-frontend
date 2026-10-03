import { useState } from "react";
import { FileText, Paperclip } from "lucide-react";
import { getErrorMessage } from "@/api/client";
import {
  type AllocationStatus,
  downloadFeePaymentAttachment,
  downloadFeeReceiptPdf,
  PAYMENT_METHOD_LABELS,
  type WardFeePaymentView,
} from "@/api/feePayments";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { downloadBlob } from "@/utils/download";
import { formatMoney } from "@/utils/currency";
import { formatLongDate } from "@/utils/date";

const STATUS_BADGES: Record<AllocationStatus, { label: string; variant: "neutral" | "info" | "success" | "danger" }> = {
  PENDING: { label: "Pending confirmation", variant: "info" },
  CONFIRMED: { label: "Confirmed", variant: "success" },
  REJECTED: { label: "Rejected", variant: "danger" },
  WITHDRAWN: { label: "Withdrawn", variant: "neutral" },
  VOIDED: { label: "Voided", variant: "neutral" },
};

function statusLabel(payment: WardFeePaymentView): string {
  const base = STATUS_BADGES[payment.status].label;
  if (payment.status !== "CONFIRMED" || !payment.settlement) return base;
  return `${base} · ${payment.settlement === "FULL" ? "paid in full" : "part payment"}`;
}

interface WardPaymentRowProps {
  payment: WardFeePaymentView;
  currency: string;
  onEdit: () => void;
  onWithdraw: () => void;
  onResubmit: () => void;
}

/**
 * One ward's share of one fee-payment submission on the guardian Fees page (Phase 45G) - status,
 * amount, the proof attached, any receipts issued, and the submitter's own Edit/Withdraw (while
 * pending) or Resubmit (once rejected). A confirmed amount the school adjusted shows in place of
 * the claimed one, with the claim kept alongside for reference.
 */
export function WardPaymentRow({ payment, currency, onEdit, onWithdraw, onResubmit }: WardPaymentRowProps) {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  async function download(id: string, load: () => Promise<Blob>, filename: string) {
    setDownloadingId(id);
    setDownloadError(null);
    try {
      downloadBlob(await load(), filename);
    } catch (error) {
      setDownloadError(getErrorMessage(error, "Failed to download that file"));
    } finally {
      setDownloadingId(null);
    }
  }

  const adjusted = payment.confirmedAmount != null && payment.confirmedAmount !== payment.claimedAmount;
  const shownAmount = adjusted ? payment.confirmedAmount : payment.claimedAmount;
  const canResubmit = payment.status === "REJECTED" && payment.submittedByMe;

  return (
    <li className="space-y-2 py-3 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-base font-semibold text-slate-900">{formatMoney(shownAmount, currency)}</p>
          {adjusted && (
            <p className="text-xs text-slate-500">You logged {formatMoney(payment.claimedAmount, currency)}</p>
          )}
          <p className="text-sm text-slate-600">
            {formatLongDate(payment.paymentDate)} · {PAYMENT_METHOD_LABELS[payment.method]}
          </p>
          {payment.childCount > 1 && (
            <p className="text-xs text-slate-500">
              Part of a {formatMoney(payment.totalAmount, currency)} payment covering {payment.childCount} children
            </p>
          )}
        </div>
        <Badge variant={STATUS_BADGES[payment.status].variant}>{statusLabel(payment)}</Badge>
      </div>

      {payment.optionalFees.length > 0 && (
        <p className="text-sm text-slate-600">
          Includes: {payment.optionalFees.map((fee) => fee.feeName).join(", ")}
        </p>
      )}

      {payment.reason && (payment.status === "REJECTED" || payment.status === "VOIDED") && (
        <Alert variant={payment.status === "REJECTED" ? "error" : "warning"}>
          {payment.status === "REJECTED" ? "Rejected: " : "Voided: "}
          {payment.reason}
        </Alert>
      )}

      {(payment.attachments.length > 0 || payment.receipts.length > 0) && (
        <div className="flex flex-wrap gap-2">
          {payment.receipts.map((receipt) => (
            <Button
              key={receipt.receiptId}
              variant="secondary"
              size="sm"
              loading={downloadingId === receipt.receiptId}
              onClick={() =>
                download(
                  receipt.receiptId,
                  () => downloadFeeReceiptPdf(receipt.receiptId),
                  `receipt-${receipt.receiptNumber.replaceAll("/", "-")}.pdf`,
                )
              }
            >
              <FileText className="h-4 w-4" aria-hidden="true" />
              Receipt {receipt.receiptNumber}
              {receipt.status === "VOID" ? " (void)" : ""}
            </Button>
          ))}
          {payment.attachments.map((attachment) => (
            <Button
              key={attachment.fileId}
              variant="ghost"
              size="sm"
              className="max-w-full"
              loading={downloadingId === attachment.fileId}
              onClick={() =>
                download(
                  attachment.fileId,
                  () => downloadFeePaymentAttachment(payment.paymentId, attachment.fileId),
                  attachment.fileName,
                )
              }
            >
              <Paperclip className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="truncate">{attachment.fileName}</span>
            </Button>
          ))}
        </div>
      )}

      {downloadError && <Alert variant="error">{downloadError}</Alert>}

      {(payment.canEdit || canResubmit) && (
        <div className="flex gap-2">
          {payment.canEdit && (
            <>
              <Button variant="secondary" size="sm" className="flex-1 sm:flex-none" onClick={onEdit}>
                Edit
              </Button>
              <Button variant="ghost" size="sm" className="flex-1 text-red-700 sm:flex-none" onClick={onWithdraw}>
                Withdraw
              </Button>
            </>
          )}
          {canResubmit && (
            <Button variant="secondary" size="sm" className="flex-1 sm:flex-none" onClick={onResubmit}>
              Resubmit
            </Button>
          )}
        </div>
      )}
    </li>
  );
}

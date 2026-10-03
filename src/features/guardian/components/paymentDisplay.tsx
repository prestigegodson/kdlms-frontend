import { useState } from "react";
import { FileText, Paperclip } from "lucide-react";
import { getErrorMessage } from "@/api/client";
import { downloadFeePaymentAttachment, downloadFeeReceiptPdf, type WardFeePaymentView } from "@/api/feePayments";
import { ActionMenu, type ActionMenuItem } from "@/components/ui/ActionMenu";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { PAYMENT_STATUS_BADGES, paymentStatusLabel } from "@/features/guardian/components/paymentStatus";
import { downloadBlob } from "@/utils/download";

export function PaymentStatusBadge({ payment }: { payment: WardFeePaymentView }) {
  return <Badge variant={PAYMENT_STATUS_BADGES[payment.status].variant}>{paymentStatusLabel(payment)}</Badge>;
}

interface PaymentFileLinksProps {
  payment: WardFeePaymentView;
  /** Accessible name for the menu trigger - distinct per row, since every row's trigger reads "Documents". */
  ariaLabel?: string;
}

/**
 * A guardian's view of one payment's receipts and attached proof, as a single Documents menu whose
 * items each download one file - shared by the Payments table's Documents column. A dash when the
 * payment has neither.
 */
export function PaymentFileLinks({ payment, ariaLabel }: PaymentFileLinksProps) {
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  async function download(load: () => Promise<Blob>, filename: string) {
    setDownloading(true);
    setDownloadError(null);
    try {
      downloadBlob(await load(), filename);
    } catch (error) {
      setDownloadError(getErrorMessage(error, "Failed to download that file"));
    } finally {
      setDownloading(false);
    }
  }

  if (payment.attachments.length === 0 && payment.receipts.length === 0) {
    return <span className="text-slate-400">—</span>;
  }

  const items: ActionMenuItem[] = [
    ...payment.receipts.map((receipt) => ({
      label: `Receipt ${receipt.receiptNumber}${receipt.status === "VOID" ? " (void)" : ""}`,
      icon: FileText,
      disabled: downloading,
      onSelect: () =>
        download(
          () => downloadFeeReceiptPdf(receipt.receiptId),
          `receipt-${receipt.receiptNumber.replaceAll("/", "-")}.pdf`,
        ),
    })),
    ...payment.attachments.map((attachment, index) => ({
      label: `Proof: ${attachment.fileName}`,
      icon: Paperclip,
      disabled: downloading,
      separated: index === 0 && payment.receipts.length > 0,
      onSelect: () =>
        download(() => downloadFeePaymentAttachment(payment.paymentId, attachment.fileId), attachment.fileName),
    })),
  ];

  return (
    <div className="space-y-2">
      <ActionMenu label="Documents" ariaLabel={ariaLabel} items={items} />
      {downloadError && <Alert variant="error">{downloadError}</Alert>}
    </div>
  );
}

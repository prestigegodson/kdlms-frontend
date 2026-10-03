import { Download } from "lucide-react";
import { useState } from "react";
import { getErrorMessage } from "@/api/client";
import { downloadStaffReceiptPdf, type StaffReceiptView } from "@/api/staffFeePayments";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { downloadBlob } from "@/utils/download";

/** A child's receipts (D18) - the issued one and any voided predecessors, each a PDF download. */
export function ReceiptDownloads({ receipts }: { receipts: StaffReceiptView[] }) {
  const [downloading, setDownloading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (receipts.length === 0) {
    return null;
  }

  async function download(receipt: StaffReceiptView) {
    setDownloading(receipt.receiptId);
    setError(null);
    try {
      const blob = await downloadStaffReceiptPdf(receipt.receiptId);
      downloadBlob(blob, `receipt-${receipt.receiptNumber.replaceAll("/", "-")}.pdf`);
    } catch (err) {
      setError(getErrorMessage(err, "Couldn't download the receipt"));
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div className="space-y-1">
      <ul className="flex flex-wrap gap-2">
        {receipts.map((receipt) => (
          <li key={receipt.receiptId}>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => download(receipt)}
              loading={downloading === receipt.receiptId}
              aria-label={`Download receipt ${receipt.receiptNumber}`}
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              <span className={receipt.status === "VOID" ? "line-through" : ""}>
                {receipt.receiptNumber}
              </span>
              {receipt.status === "VOID" && <Badge variant="neutral">Void</Badge>}
            </Button>
          </li>
        ))}
      </ul>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

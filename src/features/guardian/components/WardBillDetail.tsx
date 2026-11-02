import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { getErrorMessage } from "@/api/client";
import type { BillView } from "@/api/billing";
import { downloadWardBillPdf, getWardBill } from "@/api/wards";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { BillCard } from "@/features/billing/components/BillCard";
import { downloadBlob } from "@/utils/download";

interface WardBillDetailProps {
  studentId: string;
  termId: string;
}

/**
 * One ward's bill for one term with its Download PDF action - shown inline on the Bills page's
 * Latest tab and inside the Past tab's "View bill" modal. Callers key it by `studentId|termId`
 * so a ward or term change remounts it with fresh state.
 */
export function WardBillDetail({ studentId, termId }: WardBillDetailProps) {
  const [bill, setBill] = useState<BillView | null>(null);
  const [billError, setBillError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getWardBill(studentId, termId)
      .then((loaded) => {
        if (!cancelled) setBill(loaded);
      })
      .catch((error: unknown) => {
        if (!cancelled) setBillError(getErrorMessage(error, "Failed to load this bill"));
      });
    return () => {
      cancelled = true;
    };
  }, [studentId, termId]);

  async function downloadPdf() {
    if (!bill) return;
    setDownloading(true);
    setDownloadError(null);
    try {
      const blob = await downloadWardBillPdf(studentId, termId);
      downloadBlob(blob, `${bill.admissionNumber}-bill-${bill.termName}.pdf`);
    } catch (error) {
      setDownloadError(getErrorMessage(error, "Failed to download the bill"));
    } finally {
      setDownloading(false);
    }
  }

  if (billError) return <Alert variant="error">{billError}</Alert>;

  if (!bill) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Spinner /> Loading bill…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <BillCard bill={bill} />
      {downloadError && <Alert variant="error">{downloadError}</Alert>}
      <Button variant="secondary" onClick={downloadPdf} loading={downloading}>
        <Download className="h-4 w-4" aria-hidden="true" /> Download PDF
      </Button>
    </div>
  );
}

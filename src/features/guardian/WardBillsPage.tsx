import { useEffect, useState } from "react";
import { Download, ReceiptText } from "lucide-react";
import { ApiError } from "@/api/client";
import {
  downloadWardBillPdf,
  getWardBill,
  listWardBills,
  type WardBillSummaryView,
} from "@/api/wards";
import type { BillView } from "@/api/billing";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { Spinner } from "@/components/ui/Spinner";
import { StickySubHeader } from "@/components/ui/StickySubHeader";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/ui/Table";
import { BillCard } from "@/features/billing/components/BillCard";
import { WardSelector } from "@/features/guardian/components/WardSelector";
import { useWardStore } from "@/stores/wardStore";
import { downloadBlob } from "@/utils/download";
import { formatMoney } from "@/utils/currency";

/**
 * A ward's published, billable bills across every session they've ever been enrolled in (Phase
 * 21G) - a flat single page, the `WardTakeHomeQuizzesPage`/`WardLessonNotesPage` shape, but with
 * no term picker of its own: `GET /api/v1/me/wards/{id}/bills` already returns every
 * published+billable term, newest first, so `WardSelector` alone docks in the `StickySubHeader`.
 * A row's detail reuses `BillCard` verbatim (the `ThreadCard`/`AttendanceSummaryPanel`
 * "one component, two callers" precedent - the staff `BillsTab` preview modal is the other) in a
 * `Modal`, alongside a Download PDF button mirroring `WardTermResultPage`'s download idiom.
 */
export function WardBillsPage() {
  const { wards, selectedWardId, status, errorMessage: wardsError, fetchIfNeeded, retry } = useWardStore();

  useEffect(() => {
    fetchIfNeeded();
  }, [fetchIfNeeded]);

  const [bills, setBills] = useState<WardBillSummaryView[] | null>(null);
  const [billsError, setBillsError] = useState<string | null>(null);

  // A ward change resets its bill list during render (the WardTakeHomeQuizzesPage pattern)
  // rather than inside the effect below, which only fetches.
  const selectionKey = selectedWardId ?? "";
  const [lastSelectionKey, setLastSelectionKey] = useState(selectionKey);
  if (selectionKey !== lastSelectionKey) {
    setLastSelectionKey(selectionKey);
    setBills(null);
    setBillsError(null);
  }

  useEffect(() => {
    if (!selectedWardId) return;
    listWardBills(selectedWardId)
      .then(setBills)
      .catch((error: unknown) =>
        setBillsError(error instanceof ApiError ? error.message : "Failed to load this ward's bills"),
      );
  }, [selectedWardId]);

  const [selectedTermId, setSelectedTermId] = useState<string | null>(null);
  const [bill, setBill] = useState<BillView | null>(null);
  const [billError, setBillError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  function openBill(termId: string) {
    if (!selectedWardId) return;
    setSelectedTermId(termId);
    setBill(null);
    setBillError(null);
    setDownloadError(null);
    getWardBill(selectedWardId, termId)
      .then(setBill)
      .catch((error: unknown) => setBillError(error instanceof ApiError ? error.message : "Failed to load this bill"));
  }

  function closeBill() {
    setSelectedTermId(null);
    setBill(null);
    setBillError(null);
    setDownloadError(null);
  }

  async function downloadPdf() {
    if (!selectedWardId || !selectedTermId || !bill) return;
    setDownloading(true);
    setDownloadError(null);
    try {
      const blob = await downloadWardBillPdf(selectedWardId, selectedTermId);
      downloadBlob(blob, `${bill.admissionNumber}-bill-${bill.termName}.pdf`);
    } catch (error) {
      setDownloadError(error instanceof ApiError ? error.message : "Failed to download the bill");
    } finally {
      setDownloading(false);
    }
  }

  const hasWards = status === "loaded" && wards.length > 0;

  return (
    <div className="space-y-6">
      <PageHeader title="Bills" description="Your ward's published school bills." />

      {(status === "idle" || status === "loading") && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading…
        </div>
      )}
      {status === "error" && <ErrorState message={wardsError ?? "Failed to load your wards"} onRetry={retry} />}
      {status === "loaded" && wards.length === 0 && (
        <EmptyState title="No wards linked yet" description="Contact your school if you believe this is a mistake." />
      )}

      {hasWards && (
        <StickySubHeader>
          <WardSelector />
        </StickySubHeader>
      )}

      {billsError && <Alert variant="error">{billsError}</Alert>}

      {hasWards && bills === null && !billsError && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading bills…
        </div>
      )}

      {bills && bills.length === 0 && (
        <EmptyState
          icon={ReceiptText}
          title="No bills yet"
          description="Bills appear here once your school publishes them."
        />
      )}

      {bills && bills.length > 0 && (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Session</TableHeaderCell>
              <TableHeaderCell>Term</TableHeaderCell>
              <TableHeaderCell>Reference</TableHeaderCell>
              <TableHeaderCell numeric>Total</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {bills.map((wardBill) => (
              <TableRow key={wardBill.termId} onClick={() => openBill(wardBill.termId)}>
                <TableCell label="Session">{wardBill.sessionName}</TableCell>
                <TableCell label="Term">{wardBill.termName}</TableCell>
                <TableCell label="Reference">{wardBill.billReference}</TableCell>
                <TableCell label="Total" numeric>
                  {formatMoney(wardBill.total, wardBill.currency)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Modal open={selectedTermId !== null} onClose={closeBill} title={bill ? `${bill.termName} bill` : "Bill"} size="xl">
        {billError && <Alert variant="error">{billError}</Alert>}
        {!bill && !billError && (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Spinner /> Loading…
          </div>
        )}
        {bill && (
          <div className="space-y-4">
            <BillCard bill={bill} />
            {downloadError && <Alert variant="error">{downloadError}</Alert>}
            <Button variant="secondary" onClick={downloadPdf} loading={downloading}>
              <Download className="h-4 w-4" aria-hidden="true" /> Download PDF
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
}

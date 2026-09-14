import { useCallback, useEffect, useState } from "react";
import { type BillExportView, createBillExport, downloadBillExport, getBillExport } from "@/api/billing";
import { ApiError } from "@/api/client";
import { downloadBlob } from "@/utils/download";

const POLL_INTERVAL_MS = 3000;
const IN_FLIGHT_STATUSES = new Set<BillExportView["status"]>(["QUEUED", "RUNNING"]);

interface UseBillExportResult {
  job: BillExportView | null;
  loading: boolean;
  error: string | null;
  generating: boolean;
  generate: () => Promise<void>;
  downloading: boolean;
  downloadError: string | null;
  download: () => Promise<void>;
}

/**
 * Polls a bill export job for one branch's one advance-bill level - the `useClassReportExport`
 * shape verbatim, minus the `ResultScope` axis (a bill has no mid-term/end-of-term split).
 * Deliberately a chained `setTimeout`, never `setInterval`, so a slow response can never stack
 * overlapping requests. Polls only while the job is `QUEUED`/`RUNNING`; stops on `READY`/
 * `FAILED`, on unmount, and whenever the level/branch/term selection changes.
 */
export function useBillExport(levelId: string, termId: string, branchId?: string): UseBillExportResult {
  const [job, setJob] = useState<BillExportView | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  // Bumped by generate() so the effect below restarts polling even when the selection hasn't
  // changed (e.g. regenerating a READY/FAILED job, whose poll loop already stopped).
  const [pollToken, setPollToken] = useState(0);

  // Selection resets job/error state during render (the useClassReportExport pattern) rather than
  // inside the effect below, which only fetches.
  const selectionKey = `${branchId ?? ""}|${levelId}|${termId}`;
  const [lastSelectionKey, setLastSelectionKey] = useState(selectionKey);
  if (selectionKey !== lastSelectionKey) {
    setLastSelectionKey(selectionKey);
    setJob(null);
    setError(null);
  }

  useEffect(() => {
    if (!termId || !levelId) {
      return;
    }
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    // Only the very first call of this effect run shows the "checking" spinner - a recursive
    // poll tick shouldn't flicker it back on.
    let firstCall = true;

    async function poll() {
      if (firstCall) {
        firstCall = false;
        setLoading(true);
      }
      try {
        const view = await getBillExport(levelId, termId, branchId);
        if (cancelled) return;
        setJob(view);
        setError(null);
        if (view && IN_FLIGHT_STATUSES.has(view.status)) {
          timeoutId = setTimeout(poll, POLL_INTERVAL_MS);
        }
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : "Failed to load the export status");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    poll();

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [levelId, termId, branchId, pollToken]);

  const generate = useCallback(async () => {
    setGenerating(true);
    setError(null);
    try {
      const view = await createBillExport(levelId, termId, branchId);
      setJob(view);
      setPollToken((token) => token + 1);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to start the export");
    } finally {
      setGenerating(false);
    }
  }, [levelId, termId, branchId]);

  const download = useCallback(async () => {
    setDownloading(true);
    setDownloadError(null);
    try {
      const blob = await downloadBillExport(levelId, termId, branchId);
      downloadBlob(blob, job?.fileName ?? "bills.zip");
    } catch (err) {
      setDownloadError(err instanceof ApiError ? err.message : "Failed to download the export");
    } finally {
      setDownloading(false);
    }
  }, [levelId, termId, branchId, job]);

  return { job, loading, error, generating, generate, downloading, downloadError, download };
}

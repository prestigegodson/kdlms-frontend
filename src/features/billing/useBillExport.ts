import { useCallback, useEffect, useState } from "react";
import {
  type BillExportTarget,
  type BillExportView,
  createBillExport,
  downloadBillExport,
  getBillExport,
} from "@/api/billing";
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

function targetKey(target: BillExportTarget): string {
  return target.kind === "class" ? `class|${target.classId}` : `level|${target.branchId ?? ""}|${target.levelId}`;
}

/**
 * Polls a bill export job (Phase 21E, class-scoped; Phase 30 added the level target for the
 * Advance bills tab) - the `useClassReportExport` shape verbatim, minus the `ResultScope` axis (a
 * bill has no mid-term/end-of-term split). Deliberately a chained `setTimeout`, never
 * `setInterval`, so a slow response can never stack overlapping requests. Polls only while the job
 * is `QUEUED`/`RUNNING`; stops on `READY`/`FAILED`, on unmount, and whenever the target/term
 * selection changes.
 */
export function useBillExport(target: BillExportTarget, termId: string): UseBillExportResult {
  const [job, setJob] = useState<BillExportView | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  // Bumped by generate() so the effect below restarts polling even when the target/term selection
  // hasn't changed (e.g. regenerating a READY/FAILED job, whose poll loop already stopped).
  const [pollToken, setPollToken] = useState(0);

  // Selection resets job/error state during render (the useClassReportExport pattern) rather than
  // inside the effect below, which only fetches.
  const selectionKey = `${targetKey(target)}|${termId}`;
  const [lastSelectionKey, setLastSelectionKey] = useState(selectionKey);
  if (selectionKey !== lastSelectionKey) {
    setLastSelectionKey(selectionKey);
    setJob(null);
    setError(null);
  }

  useEffect(() => {
    if (!termId) {
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
        const view = await getBillExport(target, termId);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- selectionKey stands in for target's own fields
  }, [selectionKey, termId, pollToken]);

  const generate = useCallback(async () => {
    setGenerating(true);
    setError(null);
    try {
      const view = await createBillExport(target, termId);
      setJob(view);
      setPollToken((token) => token + 1);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to start the export");
    } finally {
      setGenerating(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- selectionKey stands in for target's own fields
  }, [selectionKey, termId]);

  const download = useCallback(async () => {
    setDownloading(true);
    setDownloadError(null);
    try {
      const blob = await downloadBillExport(target, termId);
      downloadBlob(blob, job?.fileName ?? "bills.zip");
    } catch (err) {
      setDownloadError(err instanceof ApiError ? err.message : "Failed to download the export");
    } finally {
      setDownloading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- selectionKey stands in for target's own fields
  }, [selectionKey, termId, job]);

  return { job, loading, error, generating, generate, downloading, downloadError, download };
}

import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/api/client";
import {
  createClassReportExport,
  downloadClassReportExport,
  getClassReportExport,
  type ClassReportExportView,
} from "@/api/reports";
import type { ResultScope } from "@/api/types";
import { downloadBlob } from "@/utils/download";

const POLL_INTERVAL_MS = 3000;
const IN_FLIGHT_STATUSES = new Set<ClassReportExportView["status"]>(["QUEUED", "RUNNING"]);

interface UseClassReportExportResult {
  job: ClassReportExportView | null;
  loading: boolean;
  error: string | null;
  generating: boolean;
  generate: () => Promise<void>;
  downloading: boolean;
  downloadError: string | null;
  download: () => Promise<void>;
}

/**
 * Polls a class's bulk report export job (Phase 19) - the first polling
 * precedent in this frontend (no react-query/SWR here, see
 * `ConnectivityPanel` for the `let cancelled = false` cleanup idiom this
 * borrows). Deliberately a chained `setTimeout`, never `setInterval`, so a
 * slow response can never stack overlapping requests. Polls only while the
 * job is `QUEUED`/`RUNNING`; stops on `READY`/`FAILED`, on unmount, and
 * whenever the class/term/scope selection changes.
 */
export function useClassReportExport(
  classId: string,
  termId: string,
  scope: ResultScope,
): UseClassReportExportResult {
  const [job, setJob] = useState<ClassReportExportView | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  // Bumped by generate() so the effect below restarts polling even when the
  // class/term/scope selection hasn't changed (e.g. regenerating a READY/
  // FAILED job, whose poll loop already stopped).
  const [pollToken, setPollToken] = useState(0);

  // Selection resets job/error state during render (the pattern
  // `ReportsPage`/`AdminResultsPanel` document) rather than inside the
  // effect below, which only fetches.
  const selectionKey = `${classId}|${termId}|${scope}`;
  const [lastSelectionKey, setLastSelectionKey] = useState(selectionKey);
  if (selectionKey !== lastSelectionKey) {
    setLastSelectionKey(selectionKey);
    setJob(null);
    setError(null);
  }

  useEffect(() => {
    if (!classId || !termId) {
      return;
    }
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    // Only the very first call of this effect run shows the "checking"
    // spinner - a recursive poll tick shouldn't flicker it back on.
    let firstCall = true;

    async function poll() {
      if (firstCall) {
        firstCall = false;
        setLoading(true);
      }
      try {
        const view = await getClassReportExport(classId, termId, scope);
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
  }, [classId, termId, scope, pollToken]);

  const generate = useCallback(async () => {
    setGenerating(true);
    setError(null);
    try {
      const view = await createClassReportExport(classId, termId, scope);
      setJob(view);
      setPollToken((token) => token + 1);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to start the export");
    } finally {
      setGenerating(false);
    }
  }, [classId, termId, scope]);

  const download = useCallback(async () => {
    setDownloading(true);
    setDownloadError(null);
    try {
      const blob = await downloadClassReportExport(classId, termId, scope);
      downloadBlob(blob, job?.fileName ?? "class-reports.zip");
    } catch (err) {
      setDownloadError(err instanceof ApiError ? err.message : "Failed to download the export");
    } finally {
      setDownloading(false);
    }
  }, [classId, termId, scope, job]);

  return { job, loading, error, generating, generate, downloading, downloadError, download };
}

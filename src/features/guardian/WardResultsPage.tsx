import { useEffect, useState } from "react";
import { ApiError } from "@/api/client";
import {
  downloadWardReportPdf,
  getWardResult,
  previewWardReport,
  type WardTermResultView,
  type WardTermView,
} from "@/api/wards";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { Spinner } from "@/components/ui/Spinner";
import { GradeKey } from "@/features/assessments/components/GradeKey";
import { StudentTermResultCard } from "@/features/assessments/components/StudentTermResultCard";
import { WardSelector } from "@/features/guardian/components/WardSelector";
import { WardTermSelect } from "@/features/guardian/components/WardTermSelect";
import { ReportPreviewFrame } from "@/features/reporting/components/ReportPreviewFrame";
import { useWardStore } from "@/stores/wardStore";
import { downloadBlob } from "@/utils/download";

const PUBLISHED_ONLY = (term: WardTermView) => term.resultsPublished;

/**
 * A ward's published term results - ward + term pickers, then the same
 * `StudentTermResultCard`/`GradeKey` the staff broadsheet uses, plus preview
 * and PDF download (the same `ReportPreviewFrame`/`downloadBlob` pattern
 * `ReportsPage` uses for staff). Only published terms are selectable here -
 * `WardTermSelect`'s `filter` prop, not a client-side guess - the backend
 * itself 404s on an unpublished term regardless.
 */
export function WardResultsPage() {
  const { wards, selectedWardId, status, fetchIfNeeded } = useWardStore();
  const [termId, setTermId] = useState("");
  const [result, setResult] = useState<WardTermResultView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  useEffect(() => {
    fetchIfNeeded();
  }, [fetchIfNeeded]);

  // Ward/term change resets downstream state during render (the pattern
  // `AdminResultsPanel`/`ReportsPage` document) rather than in an effect.
  const selectionKey = `${selectedWardId}|${termId}`;
  const [lastSelectionKey, setLastSelectionKey] = useState(selectionKey);
  if (selectionKey !== lastSelectionKey) {
    setLastSelectionKey(selectionKey);
    setResult(null);
    setLoadError(null);
  }

  useEffect(() => {
    if (!selectedWardId || !termId) return;
    getWardResult(selectedWardId, termId)
      .then(setResult)
      .catch((error: unknown) => setLoadError(error instanceof ApiError ? error.message : "Failed to load result"));
  }, [selectedWardId, termId]);

  async function handlePreview() {
    if (!selectedWardId || !termId) return;
    setPreviewOpen(true);
    setPreviewHtml(null);
    setPreviewError(null);
    try {
      const html = await previewWardReport(selectedWardId, termId);
      setPreviewHtml(html);
    } catch (error) {
      setPreviewError(error instanceof ApiError ? error.message : "Failed to render this report");
    }
  }

  async function handleDownload() {
    if (!selectedWardId || !termId || !result) return;
    setDownloading(true);
    setDownloadError(null);
    try {
      const blob = await downloadWardReportPdf(selectedWardId, termId);
      downloadBlob(blob, `${result.result.admissionNumber || result.result.studentName}-result.pdf`);
    } catch (error) {
      setDownloadError(error instanceof ApiError ? error.message : "Failed to download the report");
    } finally {
      setDownloading(false);
    }
  }

  const hasWards = status === "loaded" && wards.length > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Results"
        description="Published term results for your wards."
        actions={
          result && (
            <Button variant="accent" onClick={handleDownload} loading={downloading}>
              Download PDF
            </Button>
          )
        }
      />

      {(status === "idle" || status === "loading") && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading…
        </div>
      )}
      {status === "loaded" && wards.length === 0 && (
        <EmptyState title="No wards linked yet" description="Contact your school if you believe this is a mistake." />
      )}

      {hasWards && (
        <div className="flex flex-wrap gap-4">
          <WardSelector />
          {selectedWardId && (
            <WardTermSelect
              studentId={selectedWardId}
              termId={termId}
              onTermChange={(term) => setTermId(term.termId)}
              filter={PUBLISHED_ONLY}
              emptyMessage="No published results yet for this ward."
            />
          )}
        </div>
      )}

      {downloadError && <Alert variant="error">{downloadError}</Alert>}
      {loadError && <Alert variant="error">{loadError}</Alert>}

      {hasWards && selectedWardId && termId && !result && !loadError && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading result…
        </div>
      )}

      {result && (
        <div className="space-y-4">
          <StudentTermResultCard result={result.result} />
          <Card>
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Grade key</h2>
            <GradeKey system={result.gradingSystem} />
          </Card>
          <Button variant="secondary" onClick={handlePreview}>
            Preview report
          </Button>
        </div>
      )}

      {previewOpen && (
        <Modal open onClose={() => setPreviewOpen(false)} title="Report preview" size="xl">
          {previewError && <Alert variant="error">{previewError}</Alert>}
          {!previewError && !previewHtml && (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Spinner /> Rendering…
            </div>
          )}
          {previewHtml && <ReportPreviewFrame html={previewHtml} />}
        </Modal>
      )}
    </div>
  );
}

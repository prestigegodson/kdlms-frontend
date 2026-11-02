import { useEffect, useState, type ReactNode } from "react";
import { ApiError } from "@/api/client";
import type { ResultScope } from "@/api/types";
import {
  downloadWardReportPdf,
  getWardResult,
  previewWardReport,
  type WardTermResultView,
} from "@/api/wards";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { Spinner } from "@/components/ui/Spinner";
import { GradeKey } from "@/features/assessments/components/GradeKey";
import { StudentTermResultCard } from "@/features/assessments/components/StudentTermResultCard";
import { TraitKey } from "@/features/assessments/components/TraitKey";
import { ReportPreviewFrame } from "@/features/reporting/components/ReportPreviewFrame";
import { downloadBlob } from "@/utils/download";

interface WardResultReportProps {
  studentId: string;
  termId: string;
  scope: ResultScope;
  /** Shown on the left of the report's action row (e.g. the term and scope on the Latest tab). */
  heading?: ReactNode;
}

/**
 * One published ward result: the result card, grade and trait keys, Preview
 * and Download PDF. Shared by the Latest tab of `WardResultsHomePage` and a
 * past report (`WardTermResultPage`), so the fetch/preview/download logic
 * lives once. The backend 404s an unpublished term, which renders an
 * explanatory empty state rather than a raw error (covers a stale bookmark to
 * a term unpublished after the fact).
 */
export function WardResultReport({ studentId, termId, scope, heading }: WardResultReportProps) {
  const [result, setResult] = useState<WardTermResultView | null>(null);
  const [notPublished, setNotPublished] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  // A ward, term or scope change resets the previous result during render
  // (the pattern `WardResultsLayout` documents) rather than inside the effect
  // below, which only fetches.
  const resultKey = `${studentId}|${termId}|${scope}`;
  const [lastResultKey, setLastResultKey] = useState(resultKey);
  if (resultKey !== lastResultKey) {
    setLastResultKey(resultKey);
    setResult(null);
    setNotPublished(false);
    setLoadError(null);
    setDownloadError(null);
  }

  useEffect(() => {
    let cancelled = false;
    getWardResult(studentId, termId, scope)
      .then((loaded) => {
        if (!cancelled) setResult(loaded);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof ApiError && error.status === 404) {
          setNotPublished(true);
          return;
        }
        setLoadError(error instanceof ApiError ? error.message : "Failed to load result");
      });
    return () => {
      cancelled = true;
    };
  }, [studentId, termId, scope]);

  async function handlePreview() {
    setPreviewOpen(true);
    setPreviewHtml(null);
    setPreviewError(null);
    try {
      setPreviewHtml(await previewWardReport(studentId, termId, scope));
    } catch (error) {
      setPreviewError(error instanceof ApiError ? error.message : "Failed to render this report");
    }
  }

  async function handleDownload() {
    if (!result) return;
    setDownloading(true);
    setDownloadError(null);
    try {
      const blob = await downloadWardReportPdf(studentId, termId, scope);
      const stem = result.result.admissionNumber || result.result.studentName;
      downloadBlob(blob, scope === "MIDTERM" ? `${stem}-result-midterm.pdf` : `${stem}-result.pdf`);
    } catch (error) {
      setDownloadError(error instanceof ApiError ? error.message : "Failed to download the report");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="space-y-4">
      {(heading || result) && (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">{heading}</div>
          {result && (
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={handlePreview}>
                Preview report
              </Button>
              <Button variant="accent" onClick={handleDownload} loading={downloading}>
                Download PDF
              </Button>
            </div>
          )}
        </div>
      )}

      {downloadError && <Alert variant="error">{downloadError}</Alert>}
      {loadError && <Alert variant="error">{loadError}</Alert>}
      {notPublished && (
        <EmptyState
          title={scope === "MIDTERM" ? "Mid-term results not published yet" : "Results not published yet"}
          description={
            scope === "MIDTERM"
              ? "Your school hasn't published this term's mid-term results yet."
              : "Your school hasn't published this term's results yet."
          }
        />
      )}

      {!result && !notPublished && !loadError && (
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
          {(result.traitConfiguration.affectiveEnabled || result.traitConfiguration.psychomotorEnabled) && (
            <Card>
              <h2 className="mb-3 text-sm font-semibold text-slate-900">Behavioural traits key</h2>
              <TraitKey configuration={result.traitConfiguration} />
            </Card>
          )}
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

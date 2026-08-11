import { useEffect, useState } from "react";
import { useParams } from "react-router";
import { ApiError } from "@/api/client";
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
import { PageHeader } from "@/components/ui/PageHeader";
import { Spinner } from "@/components/ui/Spinner";
import { GradeKey } from "@/features/assessments/components/GradeKey";
import { StudentTermResultCard } from "@/features/assessments/components/StudentTermResultCard";
import { WardBreadcrumb } from "@/features/guardian/components/WardBreadcrumb";
import { useWardResultsContext } from "@/features/guardian/WardResultsLayout";
import { ReportPreviewFrame } from "@/features/reporting/components/ReportPreviewFrame";
import { downloadBlob } from "@/utils/download";

/**
 * Step 4 of the results drill-down - the report itself. `studentId`/
 * `sessionId`/`termId` come from the URL, so a route change (switching term
 * via the breadcrumb, or a direct bookmark) remounts this page rather than
 * needing the old flat page's ward/term reset dance. The backend 404s an
 * unpublished term regardless of what step 3 offered, so that case renders
 * an explanatory empty state rather than a raw error - covers a stale
 * bookmark to a term unpublished after the fact.
 */
export function WardTermResultPage() {
  const { ward, terms } = useWardResultsContext();
  const { sessionId, termId } = useParams<{ sessionId: string; termId: string }>();
  const [result, setResult] = useState<WardTermResultView | null>(null);
  const [notPublished, setNotPublished] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  // A term change resets the previous term's result during render (the
  // pattern `WardResultsLayout` documents) rather than inside the effect
  // below, which only fetches.
  const [lastTermId, setLastTermId] = useState(termId);
  if (termId !== lastTermId) {
    setLastTermId(termId);
    setResult(null);
    setNotPublished(false);
    setLoadError(null);
  }

  useEffect(() => {
    if (!termId) return;
    getWardResult(ward.studentId, termId)
      .then(setResult)
      .catch((error: unknown) => {
        if (error instanceof ApiError && error.status === 404) {
          setNotPublished(true);
          return;
        }
        setLoadError(error instanceof ApiError ? error.message : "Failed to load result");
      });
  }, [ward.studentId, termId]);

  async function handlePreview() {
    if (!termId) return;
    setPreviewOpen(true);
    setPreviewHtml(null);
    setPreviewError(null);
    try {
      const html = await previewWardReport(ward.studentId, termId);
      setPreviewHtml(html);
    } catch (error) {
      setPreviewError(error instanceof ApiError ? error.message : "Failed to render this report");
    }
  }

  async function handleDownload() {
    if (!termId || !result) return;
    setDownloading(true);
    setDownloadError(null);
    try {
      const blob = await downloadWardReportPdf(ward.studentId, termId);
      downloadBlob(blob, `${result.result.admissionNumber || result.result.studentName}-result.pdf`);
    } catch (error) {
      setDownloadError(error instanceof ApiError ? error.message : "Failed to download the report");
    } finally {
      setDownloading(false);
    }
  }

  const term = terms.find((candidate) => candidate.termId === termId);
  const title = term ? `${term.termName} · ${term.sessionName}` : "Result";

  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        backTo={`/guardian/results/${ward.studentId}/${sessionId}`}
        actions={
          result && (
            <Button variant="accent" onClick={handleDownload} loading={downloading}>
              Download PDF
            </Button>
          )
        }
      />
      {term && (
        <WardBreadcrumb
          steps={[
            { label: ward.schoolName, to: "/guardian/results" },
            { label: ward.fullName, to: `/guardian/results/${ward.studentId}` },
            { label: term.sessionName, to: `/guardian/results/${ward.studentId}/${sessionId}` },
            { label: term.termName },
          ]}
        />
      )}

      {downloadError && <Alert variant="error">{downloadError}</Alert>}
      {loadError && <Alert variant="error">{loadError}</Alert>}
      {notPublished && (
        <EmptyState
          title="Results not published yet"
          description="Your school hasn't published this term's results yet."
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

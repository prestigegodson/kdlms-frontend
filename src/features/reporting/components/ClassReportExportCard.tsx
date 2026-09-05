import { Download, FileArchive } from "lucide-react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { RegisterProgress } from "@/features/attendance/components/RegisterProgress";
import { useClassReportExport } from "@/features/reporting/useClassReportExport";
import type { ResultScope } from "@/api/types";

interface ClassReportExportCardProps {
  classId: string;
  termId: string;
  scope: ResultScope;
}

/**
 * Owns the bulk "Generate class reports" flow that used to be a single
 * synchronous "Download class PDFs" button (see `ReportsController`'s
 * removed `classPdf` endpoint) - a queued export job the UI polls via
 * `useClassReportExport`, rendered per `ClassReportExportView.status`:
 * no job yet, `QUEUED`, `RUNNING` (a live progress bar), `READY` (download +
 * regenerate), or `FAILED` (the error plus a retry). Exactly one action per
 * state is ever rendered, so the screen's one-accent-per-view budget
 * (style_guide.md) never doubles up regardless of which state is showing.
 */
export function ClassReportExportCard({ classId, termId, scope }: ClassReportExportCardProps) {
  const { job, loading, error, generating, generate, downloading, downloadError, download } = useClassReportExport(
    classId,
    termId,
    scope,
  );

  return (
    <Card>
      <div className="flex items-start gap-3">
        <FileArchive className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Class reports</h2>
            <p className="text-sm text-slate-500">
              Render every student&apos;s report for this class and download them as one ZIP file.
            </p>
          </div>

          {error && <Alert variant="error">{error}</Alert>}
          {downloadError && <Alert variant="error">{downloadError}</Alert>}

          {loading && !job && (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Spinner /> Checking for an existing export…
            </div>
          )}

          {!loading && !job && (
            <Button variant="accent" onClick={generate} loading={generating}>
              Generate class reports
            </Button>
          )}

          {job?.status === "QUEUED" && (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Spinner /> Queued…
            </div>
          )}

          {job?.status === "RUNNING" && (
            <RegisterProgress
              markedCount={job.renderedCount}
              totalCount={job.totalStudents}
              itemLabel="report"
              verbLabel="rendered"
            />
          )}

          {job?.status === "READY" && (
            <div className="space-y-3">
              <p className="text-sm text-slate-600">
                {job.totalStudents} {job.totalStudents === 1 ? "report" : "reports"}
                {job.sizeBytes != null && <> · {formatBytes(job.sizeBytes)}</>}
                {job.expiresAt && <> · {expiresLabel(job.expiresAt)}</>}
              </p>
              {job.failedCount > 0 && (
                <Alert variant="warning">
                  {job.failedCount} {job.failedCount === 1 ? "report" : "reports"} failed to render and{" "}
                  {job.failedCount === 1 ? "is" : "are"} missing from the archive.
                  {job.lastError && ` (${job.lastError})`}
                </Alert>
              )}
              <div className="flex flex-wrap gap-2">
                <Button variant="accent" onClick={download} loading={downloading}>
                  <Download className="h-4 w-4" aria-hidden="true" /> Download ZIP
                </Button>
                <Button variant="secondary" onClick={generate} loading={generating}>
                  Regenerate
                </Button>
              </div>
            </div>
          )}

          {job?.status === "FAILED" && (
            <div className="space-y-3">
              <Alert variant="error">{job.lastError ?? "The export failed to render."}</Alert>
              <Button variant="accent" onClick={generate} loading={generating}>
                Try again
              </Button>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`;
}

function expiresLabel(expiresAt: string): string {
  const days = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86_400_000);
  if (days <= 0) return "expiring soon";
  return `expires in ${days} ${days === 1 ? "day" : "days"}`;
}

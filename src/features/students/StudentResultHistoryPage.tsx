import { useEffect, useState } from "react";
import { useParams } from "react-router";
import { getStudentResult, type StudentTermResultView } from "@/api/assessments";
import { ApiError } from "@/api/client";
import { getGradingSystem, type GradingSystemView } from "@/api/gradingSystems";
import { downloadStudentReportPdf, previewStudentReport } from "@/api/reports";
import { getStudent, listStudentTerms, type StudentTermView, type StudentView } from "@/api/students";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { Spinner } from "@/components/ui/Spinner";
import { StickySubHeader } from "@/components/ui/StickySubHeader";
import { GradeKey } from "@/features/assessments/components/GradeKey";
import { StudentTermResultCard } from "@/features/assessments/components/StudentTermResultCard";
import { ReportPreviewFrame } from "@/features/reporting/components/ReportPreviewFrame";
import { downloadBlob } from "@/utils/download";

/**
 * A single enrolled session's result history for a school/branch admin -
 * reached by tapping a row on the student detail page's enrollment history
 * (`StudentDetailPage.tsx`'s `EnrollmentHistoryCard`). Deliberately one page
 * with a segmented term picker rather than the guardian portal's separate
 * sessions/terms/result routes (`WardSessionTermsPage`/`WardTermResultPage`)
 * - a session only ever has 1-3 terms, so a further route level would be a
 * click for no benefit; staff also aren't publication-gated the way a
 * guardian is, so there's no "not published yet" branch to isolate onto its
 * own step.
 */
export function StudentResultHistoryPage() {
  const { studentId, sessionId } = useParams<{ studentId: string; sessionId: string }>();
  const [student, setStudent] = useState<StudentView | null>(null);
  const [terms, setTerms] = useState<StudentTermView[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [termId, setTermId] = useState<string | null>(null);
  const [result, setResult] = useState<StudentTermResultView | null>(null);
  const [gradingSystem, setGradingSystem] = useState<GradingSystemView | null>(null);
  const [noResult, setNoResult] = useState(false);
  const [resultError, setResultError] = useState<string | null>(null);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  useEffect(() => {
    if (!studentId) return;
    getStudent(studentId)
      .then(setStudent)
      .catch((error: unknown) => setLoadError(error instanceof ApiError ? error.message : "Failed to load student"));
    listStudentTerms(studentId)
      .then((allTerms) => {
        const sessionTerms = allTerms
          .filter((term) => term.sessionId === sessionId)
          .sort((a, b) => a.termNumber - b.termNumber);
        setTerms(sessionTerms);
        const preferred = sessionTerms.find((term) => term.currentSession) ?? sessionTerms[0];
        setTermId(preferred?.termId ?? null);
      })
      .catch((error: unknown) =>
        setLoadError(error instanceof ApiError ? error.message : "Failed to load result history"),
      );
  }, [studentId, sessionId]);

  // A term change resets the previous term's result during render (the
  // pattern WardTermResultPage.tsx documents) rather than inside the effect
  // below, which only fetches.
  const [lastTermId, setLastTermId] = useState(termId);
  if (termId !== lastTermId) {
    setLastTermId(termId);
    setResult(null);
    setGradingSystem(null);
    setNoResult(false);
    setResultError(null);
  }

  useEffect(() => {
    if (!studentId || !termId) return;
    const term = terms?.find((candidate) => candidate.termId === termId);
    if (!term) return;

    getStudentResult(studentId, termId)
      .then(setResult)
      .catch((error: unknown) => {
        if (error instanceof ApiError && error.status === 404) {
          setNoResult(true);
          return;
        }
        setResultError(error instanceof ApiError ? error.message : "Failed to load this term's result");
      });

    getGradingSystem(term.levelId)
      .then(setGradingSystem)
      .catch(() => setGradingSystem(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- terms is read for the current termId's levelId only, not a dependency of the fetch itself
  }, [studentId, termId]);

  async function handlePreview() {
    if (!studentId || !termId) return;
    setPreviewOpen(true);
    setPreviewHtml(null);
    setPreviewError(null);
    try {
      const html = await previewStudentReport(studentId, termId);
      setPreviewHtml(html);
    } catch (error) {
      setPreviewError(error instanceof ApiError ? error.message : "Failed to render this report");
    }
  }

  async function handleDownload() {
    if (!studentId || !termId || !result) return;
    setDownloading(true);
    setDownloadError(null);
    try {
      const blob = await downloadStudentReportPdf(studentId, termId);
      downloadBlob(blob, `${result.admissionNumber || result.studentName}-result.pdf`);
    } catch (error) {
      setDownloadError(error instanceof ApiError ? error.message : "Failed to download the report");
    } finally {
      setDownloading(false);
    }
  }

  const sessionName = terms?.[0]?.sessionName ?? "";
  const className = terms?.[0]?.className ?? "";
  const selectedTerm = terms?.find((term) => term.termId === termId) ?? null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={student?.fullName ?? "Result history"}
        description={sessionName ? `${sessionName}${className ? ` · ${className}` : ""}` : undefined}
        backTo={studentId ? `/school/students/${studentId}` : undefined}
        actions={
          result && (
            <Button variant="accent" onClick={handleDownload} loading={downloading}>
              Download PDF
            </Button>
          )
        }
      />

      {loadError && <Alert variant="error">{loadError}</Alert>}
      {downloadError && <Alert variant="error">{downloadError}</Alert>}

      {terms === null && !loadError && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading…
        </div>
      )}

      {terms !== null && terms.length === 0 && (
        <EmptyState
          title="No terms found"
          description="This session has no terms configured, so there's nothing to show."
        />
      )}

      {terms !== null && terms.length > 0 && (
        <>
          <StickySubHeader>
            {terms.map((term) => (
              <Button
                key={term.termId}
                type="button"
                size="sm"
                variant={term.termId === termId ? "primary" : "secondary"}
                className="flex-1 justify-center lg:flex-none"
                onClick={() => setTermId(term.termId)}
              >
                {term.termName}
                <Badge
                  variant={term.resultsPublished ? "success" : "neutral"}
                  className={term.termId === termId ? "bg-white/20 text-white" : undefined}
                >
                  {term.resultsPublished ? "Published" : "Unpublished"}
                </Badge>
              </Button>
            ))}
          </StickySubHeader>

          {resultError && <Alert variant="error">{resultError}</Alert>}
          {noResult && (
            <EmptyState
              title="No results recorded"
              description={`No scores or ratings were entered for ${selectedTerm?.termName ?? "this term"}.`}
            />
          )}

          {!result && !noResult && !resultError && (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Spinner /> Loading result…
            </div>
          )}

          {result && (
            <div className="space-y-4">
              <StudentTermResultCard result={result} />
              {gradingSystem && (
                <Card>
                  <h2 className="mb-3 text-sm font-semibold text-slate-900">Grade key</h2>
                  <GradeKey system={gradingSystem} />
                </Card>
              )}
              <Button variant="secondary" onClick={handlePreview}>
                Preview report
              </Button>
            </div>
          )}
        </>
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

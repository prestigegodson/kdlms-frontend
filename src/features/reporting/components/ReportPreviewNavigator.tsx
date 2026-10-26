import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ApiError } from "@/api/client";
import { previewStudentReport } from "@/api/reports";
import type { ResultScope } from "@/api/types";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { Spinner } from "@/components/ui/Spinner";
import { ReportPreviewFrame } from "@/features/reporting/components/ReportPreviewFrame";
import type { ReportStudentRow } from "@/features/reporting/components/StudentReportList";
import { downloadStudentReport } from "@/features/reporting/downloadStudentReport";

type PreviewEntry = { html: string } | { error: string };

interface ReportPreviewNavigatorProps {
  /** The class roster, in the order Previous/Next walks it. */
  students: ReportStudentRow[];
  termId: string;
  scope: ResultScope;
  /** The student whose report is showing - must be one of `students`. */
  studentId: string;
  onStudentChange: (studentId: string) => void;
  onClose: () => void;
}

/** Ignores arrow keys aimed at a form control, so the jump-to select keeps its native keyboard behaviour. */
function isFormControl(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && ["SELECT", "INPUT", "TEXTAREA"].includes(target.tagName);
}

/**
 * The Reports page's preview modal, stepping through a class's reports one
 * student at a time - Previous/Next buttons, a jump-to select, and the
 * left/right arrow keys. Rendered reports are cached per term/scope/student
 * and the neighbours on either side are prefetched once the current one
 * lands, so stepping through a class doesn't wait on a fresh render each time.
 */
export function ReportPreviewNavigator({
  students,
  termId,
  scope,
  studentId,
  onStudentChange,
  onClose,
}: ReportPreviewNavigatorProps) {
  const [previews, setPreviews] = useState<Record<string, PreviewEntry>>({});
  // Keys already requested (in flight or settled) - a ref, so a prefetch and a navigation
  // to the same student in the same render don't both fire a request.
  const requested = useRef(new Set<string>());
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const index = students.findIndex((student) => student.studentId === studentId);
  const student = index >= 0 ? students[index] : undefined;
  const keyFor = (id: string) => `${termId}|${scope}|${id}`;
  const current = previews[keyFor(studentId)];

  function load(id: string) {
    const key = keyFor(id);
    if (requested.current.has(key)) return;
    requested.current.add(key);
    previewStudentReport(id, termId, scope)
      .then((html) => setPreviews((prev) => ({ ...prev, [key]: { html } })))
      .catch((error: unknown) =>
        setPreviews((prev) => ({
          ...prev,
          [key]: { error: error instanceof ApiError ? error.message : "Failed to render this report" },
        })),
      );
  }

  useEffect(() => {
    load(studentId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load reads the same three values
  }, [studentId, termId, scope]);

  // Prefetch either side only once the current report has settled, so it never queues behind its neighbours.
  const currentSettled = current !== undefined;
  useEffect(() => {
    if (!currentSettled) return;
    for (const neighbour of [students[index - 1], students[index + 1]]) {
      if (neighbour) load(neighbour.studentId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load reads termId/scope, already keyed via currentSettled's student
  }, [currentSettled, index, students]);

  const hasPrevious = index > 0;
  const hasNext = index >= 0 && index < students.length - 1;

  function goTo(nextIndex: number) {
    const target = students[nextIndex];
    if (!target) return;
    setDownloadError(null);
    onStudentChange(target.studentId);
  }

  // Re-bound per navigation so the listener always steps from the current index.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || isFormControl(event.target)) return;
      const step = event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : 0;
      const target = step === 0 ? undefined : students[index + step];
      if (!target) return;
      event.preventDefault();
      setDownloadError(null);
      onStudentChange(target.studentId);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [index, students, onStudentChange]);

  async function handleDownload() {
    if (!student) return;
    setDownloading(true);
    setDownloadError(null);
    try {
      await downloadStudentReport(student, termId, scope);
    } catch (error) {
      setDownloadError(error instanceof ApiError ? error.message : "Failed to download the report");
    } finally {
      setDownloading(false);
    }
  }

  const title = student
    ? `Report — ${student.studentName} (${index + 1} of ${students.length})`
    : "Report preview";

  return (
    <Modal open onClose={onClose} title={title} size="xl">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={!hasPrevious}
            onClick={() => goTo(index - 1)}
            aria-label="Previous student"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            <span className="max-sm:sr-only">Previous</span>
          </Button>
          <div className="min-w-0 flex-1">
            <Select
              id="report-preview-student"
              aria-label="Jump to student"
              value={studentId}
              onChange={(event) => goTo(students.findIndex((row) => row.studentId === event.target.value))}
            >
              {students.map((row) => (
                <option key={row.studentId} value={row.studentId}>
                  {row.admissionNumber ? `${row.studentName} · ${row.admissionNumber}` : row.studentName}
                </option>
              ))}
            </Select>
          </div>
          <Button
            variant="secondary"
            size="sm"
            disabled={!hasNext}
            onClick={() => goTo(index + 1)}
            aria-label="Next student"
          >
            <span className="max-sm:sr-only">Next</span>
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button size="sm" loading={downloading} disabled={!student} onClick={handleDownload}>
            {!downloading && <Download className="h-4 w-4" aria-hidden="true" />}
            <span className="max-sm:sr-only">Download PDF</span>
          </Button>
        </div>

        {downloadError && <Alert variant="error">{downloadError}</Alert>}
        {current && "error" in current && <Alert variant="error">{current.error}</Alert>}
        {!current && (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Spinner /> Rendering…
          </div>
        )}
        {current && "html" in current && <ReportPreviewFrame html={current.html} />}
      </div>
    </Modal>
  );
}

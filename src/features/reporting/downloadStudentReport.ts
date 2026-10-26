import { downloadStudentReportPdf } from "@/api/reports";
import type { ResultScope } from "@/api/types";
import type { ReportStudentRow } from "@/features/reporting/components/StudentReportList";
import { downloadBlob } from "@/utils/download";

/**
 * Fetches one student's report PDF and saves it - shared by `StudentReportList`'s
 * row action and `ReportPreviewNavigator`'s toolbar so the filename convention
 * (admission number, `-midterm` suffix) lives in one place.
 */
export async function downloadStudentReport(
  student: ReportStudentRow,
  termId: string,
  scope: ResultScope,
): Promise<void> {
  const blob = await downloadStudentReportPdf(student.studentId, termId, scope);
  const stem = student.admissionNumber || student.studentName;
  downloadBlob(blob, scope === "MIDTERM" ? `${stem}-result-midterm.pdf` : `${stem}-result.pdf`);
}

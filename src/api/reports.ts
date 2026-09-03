import { apiFetchBlob, apiFetchText } from "@/api/client";
import type { ResultScope } from "@/api/types";

const BASE = "/api/v1/reports";

/** Final rendered HTML for a student's term report - the report-preview screen's `iframe srcDoc` source. */
export function previewStudentReport(studentId: string, termId: string, scope: ResultScope = "TERM"): Promise<string> {
  return apiFetchText(`${BASE}/students/${studentId}/preview?termId=${termId}&scope=${scope}`);
}

export function downloadStudentReportPdf(studentId: string, termId: string, scope: ResultScope = "TERM"): Promise<Blob> {
  return apiFetchBlob(`${BASE}/students/${studentId}/pdf?termId=${termId}&scope=${scope}`);
}

/** One PDF, one page per student on the class's roster for the term. */
export function downloadClassReportsPdf(classId: string, termId: string, scope: ResultScope = "TERM"): Promise<Blob> {
  return apiFetchBlob(`${BASE}/classes/${classId}/pdf?termId=${termId}&scope=${scope}`);
}

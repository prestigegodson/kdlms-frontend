import { apiFetch, apiFetchBlob, apiFetchText, ApiError } from "@/api/client";
import type { ResultScope } from "@/api/types";

const BASE = "/api/v1/reports";

/** Final rendered HTML for a student's term report - the report-preview screen's `iframe srcDoc` source. */
export function previewStudentReport(studentId: string, termId: string, scope: ResultScope = "TERM"): Promise<string> {
  return apiFetchText(`${BASE}/students/${studentId}/preview?termId=${termId}&scope=${scope}`);
}

export function downloadStudentReportPdf(studentId: string, termId: string, scope: ResultScope = "TERM"): Promise<Blob> {
  return apiFetchBlob(`${BASE}/students/${studentId}/pdf?termId=${termId}&scope=${scope}`);
}

/** A bulk class report export job - see `ClassReportExportView` (backend) and `ClassReportExportCard`. */
export interface ClassReportExportView {
  id: string;
  status: "QUEUED" | "RUNNING" | "READY" | "FAILED";
  totalStudents: number;
  renderedCount: number;
  failedCount: number;
  fileName: string | null;
  sizeBytes: number | null;
  expiresAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Creates a fresh export job, or regenerates/returns the existing one for this class+term+scope. */
export function createClassReportExport(
  classId: string,
  termId: string,
  scope: ResultScope = "TERM",
): Promise<ClassReportExportView> {
  return apiFetch<ClassReportExportView>(`${BASE}/classes/${classId}/exports?termId=${termId}&scope=${scope}`, {
    method: "POST",
  });
}

/** The export job's current status, for polling - `null` when none has ever been requested for this class+term+scope. */
export async function getClassReportExport(
  classId: string,
  termId: string,
  scope: ResultScope = "TERM",
): Promise<ClassReportExportView | null> {
  try {
    return await apiFetch<ClassReportExportView>(
      `${BASE}/classes/${classId}/exports?termId=${termId}&scope=${scope}`,
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

/** The finished ZIP archive - only call once the job is `READY`. */
export function downloadClassReportExport(classId: string, termId: string, scope: ResultScope = "TERM"): Promise<Blob> {
  return apiFetchBlob(`${BASE}/classes/${classId}/exports/download?termId=${termId}&scope=${scope}`);
}

import { apiFetch, apiFetchBlob, apiFetchText } from "@/api/client";
import type { GradingSystemView } from "@/api/gradingSystems";
import type { StudentTermResultView } from "@/api/assessments";
import type { StudentAttendanceSummaryView } from "@/api/attendance";
import type { StudentMedicalView } from "@/api/students";
import type { ClassTimetableView } from "@/api/timetable";

/**
 * Self-service views for the currently authenticated GUARDIAN - ward
 * listing, ward term results/attendance/timetable, ward report preview/PDF.
 * Mirrors backend student.adapter.in.web.MyWardsController,
 * assessment.adapter.in.web.MyWardResultsController,
 * attendance.adapter.in.web.MyWardAttendanceController,
 * reporting.adapter.in.web.MyWardReportsController, and
 * timetable.adapter.in.web.MyWardTimetableController - all under
 * `/api/v1/me/wards`.
 */
const BASE = "/api/v1/me/wards";

/**
 * Mirrors backend student.application.port.in.MyWardView. `schoolId`/
 * `schoolName` are here because the guardian's own token carries no
 * `schoolId` - one login may hold wards at several schools (CLAUDE.md's
 * cross-school guardian rule) - so this is the only place the frontend
 * learns which school each ward belongs to.
 */
export interface MyWardView {
  studentId: string;
  fullName: string;
  admissionNumber: string;
  relationship: string;
  gender: "MALE" | "FEMALE";
  dateOfBirth?: string;
  photoFileId?: string;
  currentClassId?: string;
  currentClassName?: string;
  levelName?: string;
  status: string;
  schoolId: string;
  schoolName: string;
}

/** Mirrors backend student.application.port.in.WardTermView. */
export interface WardTermView {
  sessionId: string;
  sessionName: string;
  currentSession: boolean;
  termId: string;
  termName: string;
  termNumber: number;
  classId: string;
  className?: string;
  resultsPublished: boolean;
}

/** Mirrors backend assessment.application.port.in.MyWardResultsUseCase.WardTermResultView. */
export interface WardTermResultView {
  result: StudentTermResultView;
  gradingSystem: GradingSystemView;
}

/** Every student linked to the calling guardian. */
export function listMyWards(): Promise<MyWardView[]> {
  return apiFetch<MyWardView[]>(BASE);
}

/** Every term a ward has ever been enrolled for, across every session - not pre-filtered to published ones. */
export function listWardTerms(studentId: string): Promise<WardTermView[]> {
  return apiFetch<WardTermView[]>(`${BASE}/${studentId}/terms`);
}

/** Only resolves once the ward's class+term is published - 404 otherwise. */
export function getWardResult(studentId: string, termId: string): Promise<WardTermResultView> {
  return apiFetch<WardTermResultView>(`${BASE}/${studentId}/results?termId=${termId}`);
}

/** Not publication-gated - attendance is live operational information. */
export function getWardAttendance(studentId: string, termId: string): Promise<StudentAttendanceSummaryView> {
  return apiFetch<StudentAttendanceSummaryView>(`${BASE}/${studentId}/attendance?termId=${termId}`);
}

/** A ward's medical & emergency details, read-only - also not publication-gated. */
export function getWardMedical(studentId: string): Promise<StudentMedicalView> {
  return apiFetch<StudentMedicalView>(`${BASE}/${studentId}/medical`);
}

/** A ward's class timetable for one term, read-only - also not publication-gated, like attendance and medical info. */
export function getWardTimetable(studentId: string, termId: string): Promise<ClassTimetableView> {
  return apiFetch<ClassTimetableView>(`${BASE}/${studentId}/timetable?termId=${termId}`);
}

/**
 * A ward's photo bytes - a GUARDIAN has no access to `/api/v1/files/**` at
 * all, so this is the only path to them. Also not publication-gated, like
 * medical info and attendance.
 */
export function downloadWardPhoto(studentId: string): Promise<Blob> {
  return apiFetchBlob(`${BASE}/${studentId}/photo`);
}

/** Final rendered HTML for a ward's term report - the report-preview screen's `iframe srcDoc` source. */
export function previewWardReport(studentId: string, termId: string): Promise<string> {
  return apiFetchText(`${BASE}/${studentId}/report?termId=${termId}`);
}

export function downloadWardReportPdf(studentId: string, termId: string): Promise<Blob> {
  return apiFetchBlob(`${BASE}/${studentId}/report/pdf?termId=${termId}`);
}

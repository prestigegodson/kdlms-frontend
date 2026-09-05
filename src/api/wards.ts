import { apiFetch, apiFetchBlob, apiFetchText } from "@/api/client";
import type { GradingSystemView } from "@/api/gradingSystems";
import type { StudentTermResultView } from "@/api/assessments";
import type { TraitConfigurationView } from "@/api/traits";
import type { StudentAttendanceSummaryView } from "@/api/attendance";
import type { StudentMedicalView } from "@/api/students";
import type { ClassTimetableView } from "@/api/timetable";
import type { LessonNoteView } from "@/api/lessonNotes";
import type { ResultScope } from "@/api/types";

/**
 * Self-service views for the currently authenticated GUARDIAN - ward
 * listing, ward term results/attendance/timetable/lesson notes, ward report
 * preview/PDF. Mirrors backend student.adapter.in.web.MyWardsController,
 * assessment.adapter.in.web.MyWardResultsController,
 * attendance.adapter.in.web.MyWardAttendanceController,
 * reporting.adapter.in.web.MyWardReportsController,
 * timetable.adapter.in.web.MyWardTimetableController, and
 * lessonnote.adapter.in.web.MyWardLessonNoteController - all under
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

/**
 * Mirrors backend student.application.port.in.WardTermView.
 * `resultsPublished`/`midtermPublished` are independent (Phase 17) - a
 * term's mid-term and end-of-term results publish on separate schedules, so
 * the guardian portal can offer either scope's result the moment it,
 * specifically, is published.
 */
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
  midtermPublished: boolean;
}

/** Mirrors backend assessment.application.port.in.MyWardResultsUseCase.WardTermResultView. */
export interface WardTermResultView {
  result: StudentTermResultView;
  gradingSystem: GradingSystemView;
  traitConfiguration: TraitConfigurationView;
}

/** Every student linked to the calling guardian. */
export function listMyWards(): Promise<MyWardView[]> {
  return apiFetch<MyWardView[]>(BASE);
}

/** Every term a ward has ever been enrolled for, across every session - not pre-filtered to published ones. */
export function listWardTerms(studentId: string): Promise<WardTermView[]> {
  return apiFetch<WardTermView[]>(`${BASE}/${studentId}/terms`);
}

/** Only resolves once the ward's class+term is published for the given scope - 404 otherwise. */
export function getWardResult(
  studentId: string,
  termId: string,
  scope: ResultScope = "TERM",
): Promise<WardTermResultView> {
  return apiFetch<WardTermResultView>(`${BASE}/${studentId}/results?termId=${termId}&scope=${scope}`);
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
export function previewWardReport(studentId: string, termId: string, scope: ResultScope = "TERM"): Promise<string> {
  return apiFetchText(`${BASE}/${studentId}/report?termId=${termId}&scope=${scope}`);
}

export function downloadWardReportPdf(studentId: string, termId: string, scope: ResultScope = "TERM"): Promise<Blob> {
  return apiFetchBlob(`${BASE}/${studentId}/report/pdf?termId=${termId}&scope=${scope}`);
}

/** Mirrors backend lessonnote.application.port.in.MyWardLessonNotesUseCase.WardLessonNoteSummary. */
export interface WardLessonNoteSummary {
  noteId: string;
  weekNumber: number;
  weekStart: string | null;
  weekEnd: string | null;
  topic: string;
}

/** Mirrors backend lessonnote.application.port.in.MyWardLessonNotesUseCase.WardSubjectLessonNotesView. `notes` may be empty - a subject with nothing approved yet still gets a row. */
export interface WardSubjectLessonNotesView {
  subjectId: string;
  subjectName: string;
  notes: WardLessonNoteSummary[];
}

/**
 * The ward's applicable subjects (mandatory ∪ their registered selectives) for one term, each
 * carrying its APPROVED lesson notes - this feature's own publication gate, deliberately not
 * `resultsPublished`-gated like `getWardResult` is.
 */
export function getWardLessonNotes(studentId: string, termId: string): Promise<WardSubjectLessonNotesView[]> {
  return apiFetch<WardSubjectLessonNotesView[]>(`${BASE}/${studentId}/lesson-notes?termId=${termId}`);
}

/** One note in full, read-only - 404s unless it's APPROVED and belongs to one of this ward's applicable subjects. */
export function getWardLessonNote(studentId: string, noteId: string): Promise<LessonNoteView> {
  return apiFetch<LessonNoteView>(`${BASE}/${studentId}/lesson-notes/${noteId}`);
}

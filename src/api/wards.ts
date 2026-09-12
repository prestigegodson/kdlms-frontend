import { apiFetch, apiFetchBlob, apiFetchText } from "@/api/client";
import type { GradingSystemView } from "@/api/gradingSystems";
import type { StudentTermResultView } from "@/api/assessments";
import type { TraitConfigurationView } from "@/api/traits";
import type { StudentAttendanceSummaryView } from "@/api/attendance";
import type { StudentMedicalView } from "@/api/students";
import type { ClassTimetableView } from "@/api/timetable";
import type { LessonNoteView } from "@/api/lessonNotes";
import type { BillView } from "@/api/billing";
import type { ResultScope } from "@/api/types";

/**
 * Self-service views for the currently authenticated GUARDIAN - ward
 * listing, ward term results/attendance/timetable/lesson notes, ward report
 * preview/PDF, ward bills. Mirrors backend student.adapter.in.web.MyWardsController,
 * assessment.adapter.in.web.MyWardResultsController,
 * attendance.adapter.in.web.MyWardAttendanceController,
 * reporting.adapter.in.web.MyWardReportsController,
 * timetable.adapter.in.web.MyWardTimetableController,
 * lessonnote.adapter.in.web.MyWardLessonNoteController, and
 * billing.adapter.in.web.MyWardBillsController - all under `/api/v1/me/wards`.
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

/**
 * Mirrors backend takehomequiz.domain.QuizType - defined fresh here rather than imported from
 * `api/takeHomeQuizzes.ts`, the same deliberate per-surface duplication `api/publicTakeHomeQuiz.ts`
 * already establishes for this module's public/ward-facing shapes.
 */
export type QuizType = "MIDTERM" | "NORMAL";

/**
 * Mirrors backend takehomequiz.application.port.in.MyWardTakeHomeQuizzesUseCase.WardTakeHomeQuizSummaryView.
 * `score` is `null` for a non-submitter - never zero, which would misread as "scored zero".
 * `countsTowardMidterm` is `quizType === "MIDTERM"` - only a MIDTERM quiz ever writes back to the
 * gradebook. No per-question breakdown at v1.
 */
export interface WardTakeHomeQuizSummaryView {
  id: string;
  title: string;
  subjectName: string;
  quizType: QuizType;
  score: number | null;
  totalPoints: number;
  submitted: boolean;
  countsTowardMidterm: boolean;
  closesAt: string;
}

/** Mirrors backend takehomequiz.application.port.in.MyWardTakeHomeQuizzesUseCase.WardTakeHomeQuizView. */
export interface WardTakeHomeQuizView extends WardTakeHomeQuizSummaryView {
  instructions: string | null;
  className: string;
  resultsPublishedAt: string;
}

/**
 * Every RESULTS_PUBLISHED take-home quiz for the ward's own class in this term, narrowed to
 * subjects applicable to the ward (mandatory ∪ their registered selectives) - deliberately gated
 * on this module's own RESULTS_PUBLISHED state, not `resultsPublished`/`midtermPublished` like
 * `getWardResult` is.
 */
export function getWardTakeHomeQuizzes(studentId: string, termId: string): Promise<WardTakeHomeQuizSummaryView[]> {
  return apiFetch<WardTakeHomeQuizSummaryView[]>(`${BASE}/${studentId}/take-home-quizzes?termId=${termId}`);
}

/** One quiz's result in full, read-only - 404s unless it's RESULTS_PUBLISHED and applicable to this ward. */
export function getWardTakeHomeQuiz(studentId: string, quizId: string): Promise<WardTakeHomeQuizView> {
  return apiFetch<WardTakeHomeQuizView>(`${BASE}/${studentId}/take-home-quizzes/${quizId}`);
}

/**
 * One published+billable term on a ward's bill list. Mirrors backend
 * billing.application.port.in.WardBillSummaryView - no student fields, since a ward-scoped list
 * is always about the one path-scoped student.
 */
export interface WardBillSummaryView {
  sessionId: string;
  sessionName: string;
  termId: string;
  termName: string;
  termNumber: number;
  billReference: string;
  total: number;
  currency: string;
}

/** Every published+billable term across every session this ward has ever been enrolled in, newest first. */
export function listWardBills(studentId: string): Promise<WardBillSummaryView[]> {
  return apiFetch<WardBillSummaryView[]>(`${BASE}/${studentId}/bills`);
}

/** One term's bill in full - 404s unless the ward link, the term, its branch+term publication, and billability all hold. */
export function getWardBill(studentId: string, termId: string): Promise<BillView> {
  return apiFetch<BillView>(`${BASE}/${studentId}/bills/${termId}`);
}

/** As {@link getWardBill}, rendered as a PDF. */
export function downloadWardBillPdf(studentId: string, termId: string): Promise<Blob> {
  return apiFetchBlob(`${BASE}/${studentId}/bills/${termId}/pdf`);
}

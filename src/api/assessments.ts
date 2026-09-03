import { apiFetch } from "@/api/client";
import type { AssessmentMode, GradeBoundary, RatingOption } from "@/api/gradingSystems";
import type { ResultScope } from "@/api/types";

/** Mirrors backend assessment.application.port.in.AssessmentSheetView.SheetRowView. */
export interface SheetRow {
  enrollmentId: string;
  studentName: string;
  admissionNumber: string;
  quizScore?: number;
  examScore?: number;
  finalScore?: number;
  grade?: string;
  remark?: string;
  midtermRatingOptionId?: string;
  midtermObservation?: string;
  ratingOptionId?: string;
  observation?: string;
}

/**
 * Mirrors backend assessment.application.port.in.AssessmentSheetView - a
 * class's recording sheet for one subject/term. `quizWeight`/`examWeight`/
 * `boundaries` (NUMERIC) and `ratingOptions` (QUALITATIVE) carry the live
 * grading system alongside the roster, so ScoreEntryGrid can preview a
 * final score/grade as the teacher types, without a second request.
 * `showMidtermGrade` rides along for the same reason - it's always `true`
 * for QUALITATIVE.
 */
export interface AssessmentSheetView {
  classId: string;
  subjectId: string;
  termId: string;
  assessmentMode: AssessmentMode;
  quizWeight?: number;
  examWeight?: number;
  quizMax?: number;
  examMax?: number;
  showMidtermGrade: boolean;
  boundaries: GradeBoundary[];
  ratingOptions: RatingOption[];
  rows: SheetRow[];
}

/** Mirrors backend RecordAssessmentsUseCase.RowOutcome - per-row save result, same contract as bulk promotion. */
export interface RowOutcome {
  enrollmentId: string;
  success: boolean;
  message?: string;
}

export interface SaveOutcome {
  outcomes: RowOutcome[];
}

export interface ScoreEntry {
  enrollmentId: string;
  quizScore: number | null;
  examScore: number | null;
}

/**
 * Mirrors backend AssessmentRecordingController.RatingEntryRequest - either
 * pair may be sent alone (the backend requires at least one, matching
 * `QualitativeAssessment`'s either-rating-present rule).
 */
export interface RatingEntry {
  enrollmentId: string;
  midtermRatingOptionId: string | null;
  midtermObservation: string | null;
  ratingOptionId: string | null;
  observation: string | null;
}

/**
 * Mirrors backend assessment.application.port.in.BroadsheetView.SubjectResult.
 * `scoreMax` is only present on a MIDTERM numeric result, where `finalScore`
 * is the raw entered mark (e.g. a quiz score of 18) rather than a
 * percentage - render it as `finalScore / scoreMax`. A TERM score is
 * already out of 100 and carries no `scoreMax`.
 */
export interface SubjectResult {
  subjectId: string;
  finalScore?: number;
  scoreMax?: number;
  grade?: string;
  ratingLabel?: string;
  observation?: string;
}

/** Mirrors backend assessment.application.port.in.BroadsheetView - the whole-class results grid for one term. */
export interface BroadsheetView {
  classId: string;
  termId: string;
  assessmentMode: AssessmentMode;
  subjects: Array<{ subjectId: string; name: string; code?: string }>;
  rows: Array<{
    enrollmentId: string;
    studentId: string;
    studentName: string;
    admissionNumber: string;
    subjectResults: SubjectResult[];
    total?: number;
    average?: number;
    position?: number;
  }>;
}

/** Mirrors backend assessment.application.port.in.StudentTermResultView. */
export interface StudentTermResultView {
  studentId: string;
  enrollmentId: string;
  studentName: string;
  admissionNumber: string;
  classId: string;
  termId: string;
  assessmentMode: AssessmentMode;
  subjects: Array<{ subjectId: string; name: string; code?: string }>;
  subjectResults: SubjectResult[];
  total?: number;
  average?: number;
  position?: number;
  classTeacherRemark?: string;
  principalRemark?: string;
}

/** Mirrors backend assessment.application.port.in.RemarksSheetView.RemarkRow. */
export interface RemarkSheetRow {
  enrollmentId: string;
  studentName: string;
  admissionNumber: string;
  classTeacherRemark?: string;
  classTeacherRemarkByName?: string;
  principalRemark?: string;
}

/**
 * Mirrors backend assessment.application.port.in.RemarksSheetView - a
 * class's termly remarks sheet. `classTeacherEditable`/`principalRemarkEditable`
 * are the server's own truth for whether the corresponding save would
 * succeed for this exact class/term/caller (mirrors AttendanceRegisterView's
 * `editable`) - the frontend never re-derives this rule itself.
 */
export interface RemarksSheetView {
  classId: string;
  className: string;
  termId: string;
  classTeacherEditable: boolean;
  principalRemarkEditable: boolean;
  rows: RemarkSheetRow[];
}

/** One student's remark text for a save - a blank/whitespace value clears that half (see TermRemark.recordClassTeacherRemark/recordPrincipalRemark). */
export interface RemarkEntry {
  enrollmentId: string;
  remark: string | null;
}

export function openSheet(classId: string, subjectId: string, termId: string): Promise<AssessmentSheetView> {
  return apiFetch<AssessmentSheetView>(
    `/api/v1/assessments/sheet?classId=${classId}&subjectId=${subjectId}&termId=${termId}`,
  );
}

export function saveScores(
  classId: string,
  subjectId: string,
  termId: string,
  entries: ScoreEntry[],
): Promise<SaveOutcome> {
  return apiFetch<SaveOutcome>("/api/v1/assessments/scores", {
    method: "PUT",
    body: JSON.stringify({ classId, subjectId, termId, entries }),
  });
}

export function saveRatings(
  classId: string,
  subjectId: string,
  termId: string,
  entries: RatingEntry[],
): Promise<SaveOutcome> {
  return apiFetch<SaveOutcome>("/api/v1/assessments/ratings", {
    method: "PUT",
    body: JSON.stringify({ classId, subjectId, termId, entries }),
  });
}

export function getBroadsheet(classId: string, termId: string, scope: ResultScope = "TERM"): Promise<BroadsheetView> {
  return apiFetch<BroadsheetView>(`/api/v1/results/broadsheet?classId=${classId}&termId=${termId}&scope=${scope}`);
}

export function getStudentResult(
  studentId: string,
  termId: string,
  scope: ResultScope = "TERM",
): Promise<StudentTermResultView> {
  return apiFetch<StudentTermResultView>(`/api/v1/results/students/${studentId}?termId=${termId}&scope=${scope}`);
}

export function getPublicationStatus(
  classId: string,
  termId: string,
  scope: ResultScope = "TERM",
): Promise<{ published: boolean }> {
  return apiFetch<{ published: boolean }>(
    `/api/v1/results/publications?classId=${classId}&termId=${termId}&scope=${scope}`,
  );
}

export function publishResults(classId: string, termId: string, scope: ResultScope = "TERM"): Promise<void> {
  return apiFetch<void>("/api/v1/results/publications", {
    method: "POST",
    body: JSON.stringify({ classId, termId, scope }),
  });
}

export function unpublishResults(classId: string, termId: string, scope: ResultScope = "TERM"): Promise<void> {
  return apiFetch<void>(`/api/v1/results/publications?classId=${classId}&termId=${termId}&scope=${scope}`, {
    method: "DELETE",
  });
}

export function getRemarksSheet(classId: string, termId: string): Promise<RemarksSheetView> {
  return apiFetch<RemarksSheetView>(`/api/v1/classes/${classId}/terms/${termId}/remarks`);
}

export function saveTeacherRemarks(classId: string, termId: string, entries: RemarkEntry[]): Promise<SaveOutcome> {
  return apiFetch<SaveOutcome>(`/api/v1/classes/${classId}/terms/${termId}/remarks`, {
    method: "PUT",
    body: JSON.stringify({ entries }),
  });
}

export function savePrincipalRemarks(classId: string, termId: string, entries: RemarkEntry[]): Promise<SaveOutcome> {
  return apiFetch<SaveOutcome>(`/api/v1/classes/${classId}/terms/${termId}/principal-remarks`, {
    method: "PUT",
    body: JSON.stringify({ entries }),
  });
}

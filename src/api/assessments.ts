import { apiFetch } from "@/api/client";
import type { AssessmentMode, GradeBoundary, RatingOption } from "@/api/gradingSystems";
import type { ResultScope } from "@/api/types";
import type { SubjectAssessmentPeriods } from "@/api/subjects";

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
  /** Which columns the subject has: midterm-only hides the exam side, exam-only the midterm side. */
  assessmentPeriods: SubjectAssessmentPeriods;
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

/**
 * Mirrors backend assessment.application.port.in.BroadsheetView.SubjectColumn -
 * shared verbatim by `BroadsheetView` and `StudentTermResultView`, the same
 * way the backend record is. `classAverage` (Phase 37) is undefined unless
 * the school has turned on the "Show class average per subject" opt-in in
 * Report Settings, and always undefined for a QUALITATIVE class.
 */
export interface SubjectColumn {
  subjectId: string;
  name: string;
  code?: string;
  classAverage?: number;
}

/** Mirrors backend assessment.application.port.in.BroadsheetView - the whole-class results grid for one term. */
export interface BroadsheetView {
  classId: string;
  termId: string;
  assessmentMode: AssessmentMode;
  subjects: SubjectColumn[];
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

/** Mirrors backend assessment.application.port.in.StudentTermResultView.TraitRatingView - `category` is `"AFFECTIVE"`/`"PSYCHOMOTOR"`. */
export interface TraitRatingView {
  category: "AFFECTIVE" | "PSYCHOMOTOR";
  traitName: string;
  optionValue: string;
  optionLabel?: string;
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
  subjects: SubjectColumn[];
  subjectResults: SubjectResult[];
  total?: number;
  average?: number;
  position?: number;
  classTeacherRemark?: string;
  principalRemark?: string;
  /** Who signs `principalRemark` - "Principal" unless a level/branch commenter is configured. Never blank. */
  principalRemarkTitle: string;
  /** Empty when the level has neither behavioural-trait category enabled, or this student hasn't been rated yet. */
  traits: TraitRatingView[];
}

/** Mirrors backend assessment.application.port.in.RemarksSheetView.TraitDefinitionSheet/ScaleOptionSheet. */
export interface TraitDefinitionSheet {
  id: string;
  name: string;
}
export interface ScaleOptionSheet {
  id: string;
  value: string;
  label?: string;
}

/** Mirrors backend assessment.application.port.in.RemarksSheetView.TraitCategorySheet - `category` is `"AFFECTIVE"`/`"PSYCHOMOTOR"`. */
export interface TraitCategorySheet {
  category: "AFFECTIVE" | "PSYCHOMOTOR";
  displayName: string;
  traits: TraitDefinitionSheet[];
  scaleOptions: ScaleOptionSheet[];
}

/** Mirrors backend assessment.application.port.in.RemarksSheetView.TraitRatingEntry - `scaleOptionId` is absent when this student hasn't been rated on this trait yet. */
export interface TraitRatingEntry {
  traitId: string;
  scaleOptionId?: string;
}

/** Mirrors backend assessment.application.port.in.RemarksSheetView.RemarkRow. */
export interface RemarkSheetRow {
  enrollmentId: string;
  studentName: string;
  admissionNumber: string;
  classTeacherRemark?: string;
  classTeacherRemarkByName?: string;
  principalRemark?: string;
  traits: TraitRatingEntry[];
}

/**
 * Mirrors backend assessment.application.port.in.RemarksSheetView - a
 * class's termly remarks sheet. `classTeacherEditable`/`principalRemarkEditable`
 * are the server's own truth for whether the corresponding save would
 * succeed for this exact class/term/caller (mirrors AttendanceRegisterView's
 * `editable`) - the frontend never re-derives this rule itself.
 * `traitCategories` lists only the level's enabled behavioural-trait
 * categories (empty when neither is configured/enabled) - each `row`'s
 * `traits` then carries just that student's own ratings against them.
 */
export interface RemarksSheetView {
  classId: string;
  className: string;
  termId: string;
  classTeacherEditable: boolean;
  principalRemarkEditable: boolean;
  /** The class's live commenter title - "Principal" unless a level/branch commenter is configured. Never blank. */
  headRemarkTitle: string;
  traitCategories: TraitCategorySheet[];
  rows: RemarkSheetRow[];
}

/**
 * One student's remark text for a save - a blank/whitespace value clears
 * that half (see TermRemark.recordClassTeacherRemark/recordPrincipalRemark).
 * `traits` is `undefined` to leave this student's existing trait ratings
 * untouched (the principal save never sends it at all); a present array is
 * a full replace of every trait it names.
 */
export interface RemarkEntry {
  enrollmentId: string;
  remark: string | null;
  traits?: Array<{ traitId: string; scaleOptionId: string }>;
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

/**
 * Mirrors backend assessment.application.port.in.ClassAssessmentSheetView - the
 * class teacher's all-subjects sheet for one term: `subjects` are the grid's
 * rows, `students` its columns, and `cells` one entry per (student, subject)
 * carrying both periods' current values. `offered` is false when a selective
 * subject isn't one the student registered for. Observations are deliberately
 * absent - they stay on the single-subject sheet.
 */
export interface ClassAssessmentSheetView {
  classId: string;
  termId: string;
  assessmentMode: AssessmentMode;
  quizMax?: number;
  examMax?: number;
  ratingOptions: RatingOption[];
  subjects: Array<{
    subjectId: string;
    name: string;
    subjectGroupId?: string;
    subjectGroupName?: string;
    assessmentPeriods: SubjectAssessmentPeriods;
  }>;
  students: Array<{ enrollmentId: string; studentName: string; admissionNumber: string }>;
  cells: ClassSheetCell[];
}

export interface ClassSheetCell {
  enrollmentId: string;
  subjectId: string;
  offered: boolean;
  quizScore?: number;
  examScore?: number;
  midtermRatingOptionId?: string;
  ratingOptionId?: string;
}

/** Mirrors backend RecordAssessmentsUseCase.CellOutcome - one (student, subject) cell's save result. */
export interface CellOutcome {
  enrollmentId: string;
  subjectId: string;
  success: boolean;
  message?: string;
}

export function openClassSheet(classId: string, termId: string): Promise<ClassAssessmentSheetView> {
  return apiFetch<ClassAssessmentSheetView>(`/api/v1/assessments/class-sheet?classId=${classId}&termId=${termId}`);
}

/** `score` is the quiz mark for MIDTERM, the exam mark for TERM; `null` clears it. The other period is untouched. */
export function saveClassScores(
  classId: string,
  termId: string,
  period: ResultScope,
  entries: Array<{ enrollmentId: string; subjectId: string; score: number | null }>,
): Promise<{ outcomes: CellOutcome[] }> {
  return apiFetch<{ outcomes: CellOutcome[] }>("/api/v1/assessments/class-scores", {
    method: "PUT",
    body: JSON.stringify({ classId, termId, period, entries }),
  });
}

/** `ratingOptionId` is the period's own rating; `null` clears it. The other period and every observation are untouched. */
export function saveClassRatings(
  classId: string,
  termId: string,
  period: ResultScope,
  entries: Array<{ enrollmentId: string; subjectId: string; ratingOptionId: string | null }>,
): Promise<{ outcomes: CellOutcome[] }> {
  return apiFetch<{ outcomes: CellOutcome[] }>("/api/v1/assessments/class-ratings", {
    method: "PUT",
    body: JSON.stringify({ classId, termId, period, entries }),
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

import { ApiError, apiFetch } from "@/api/client";

/**
 * Mirrors backend insights (insights_plan.md Phase I3) - snapshot-backed early-warning reads for
 * SCHOOL_ADMIN/BRANCH_ADMIN/TEACHER, behind the package's `studentInsights` flag. Every view is a
 * nightly snapshot, never computed at read time, so each carries `computedAt`. Null fields are
 * omitted by the backend's `non-null` Jackson inclusion, hence the optional properties.
 */

export type Severity = "NONE" | "WATCH" | "AT_RISK";

export type RiskSignal =
  | "AVERAGE_DROP"
  | "POSITION_DROP"
  | "FAILING_SUBJECTS"
  | "LOW_ATTENDANCE"
  | "ABSENCE_STREAK"
  | "MISSED_QUIZZES"
  | "LEARNING_DISENGAGEMENT";

/** One fired signal: `message` is server-authored English, ready to display. */
export interface RiskReason {
  signal: RiskSignal;
  message: string;
  detail: Record<string, unknown>;
}

export interface ClassSummary {
  classId: string;
  className: string;
  levelName?: string;
  branchId?: string;
  atRisk: number;
  watch: number;
  total: number;
  computedAt?: string;
}

/** `computedAt` is the oldest snapshot counted - the honest "as fresh as" time for the whole scope. */
export interface InsightSummaryView {
  termId?: string;
  termName?: string;
  atRisk: number;
  watch: number;
  none: number;
  computedAt?: string;
  classes: ClassSummary[];
}

export interface FlaggedStudent {
  studentId: string;
  fullName?: string;
  admissionNumber?: string;
  severity: Severity;
  reasons: RiskReason[];
  metrics: Record<string, unknown>;
  firstAtRiskAt?: string;
  computedAt?: string;
}

/** `students` holds WATCH/AT_RISK only (AT_RISK first); `totalStudents` counts every snapshot. */
export interface ClassInsightsView {
  classId: string;
  className?: string;
  levelName?: string;
  termId?: string;
  termName?: string;
  totalStudents: number;
  computedAt?: string;
  students: FlaggedStudent[];
}

export interface TrendPoint {
  termId: string;
  termName?: string;
  termNumber: number;
  sessionId?: string;
  sessionName?: string;
  classId?: string;
  className?: string;
  severity: Severity;
  average?: number;
  position?: number;
  classSize?: number;
  attendanceRate?: number;
  reasons: RiskReason[];
  computedAt?: string;
}

/** `terms` are oldest first (session start, then term number). */
export interface StudentInsightTrendView {
  studentId: string;
  fullName?: string;
  admissionNumber?: string;
  computedAt?: string;
  terms: TrendPoint[];
}

export interface InsightSettings {
  averageDropPoints: number;
  positionDropPercent: number;
  failingSubjectsMin: number;
  passMark: number;
  attendanceRateMin: number;
  absenceStreakDays: number;
  missedQuizzesMin: number;
  unopenedResourceDays: number;
  unopenedResourcesMin: number;
  guardianAlertsEnabled: boolean;
}

const BASE = "/api/v1/insights";

/** True for the `feature-not-included` 403 every insights endpoint returns without `studentInsights`. */
export function isFeatureNotIncluded(error: unknown): boolean {
  return error instanceof ApiError && (error.problem?.type?.endsWith("/feature-not-included") ?? false);
}

export function getInsightsSummary(): Promise<InsightSummaryView> {
  return apiFetch(`${BASE}/summary`);
}

export function getClassInsights(classId: string, termId?: string): Promise<ClassInsightsView> {
  const query = termId ? `?termId=${encodeURIComponent(termId)}` : "";
  return apiFetch(`${BASE}/classes/${classId}${query}`);
}

export function getStudentInsightTrend(studentId: string): Promise<StudentInsightTrendView> {
  return apiFetch(`${BASE}/students/${studentId}`);
}

/** Queues the class for recompute (202) - the snapshots refresh on the worker's next poll, not in this call. */
export function recomputeClassInsights(classId: string): Promise<void> {
  return apiFetch(`${BASE}/classes/${classId}/recompute`, { method: "POST" });
}

export function getInsightSettings(): Promise<InsightSettings> {
  return apiFetch(`${BASE}/settings`);
}

/** SCHOOL_ADMIN only; saving queues every class in the school for recompute. */
export function saveInsightSettings(settings: InsightSettings): Promise<InsightSettings> {
  return apiFetch(`${BASE}/settings`, { method: "PUT", body: JSON.stringify(settings) });
}

import { apiFetch, apiFetchBlob } from "@/api/client";
import type { ClassTimetableView } from "@/api/timetable";

/**
 * Self-service views for the currently authenticated STUDENT - own profile, term history, own
 * class timetable, own photo. A student never reads their own results (guardians and staff
 * only). Mirrors backend student.adapter.in.web.MyStudentProfileController and
 * timetable.adapter.in.web.MyClassTimetableController - all under
 * `/api/v1/me`. The `api/wards.ts` analogue for a STUDENT caller rather than a GUARDIAN one.
 */
const BASE = "/api/v1/me";

/** Mirrors backend student.application.port.in.MyStudentView. */
export interface MyStudentView {
  studentId: string;
  fullName: string;
  admissionNumber: string;
  gender: "MALE" | "FEMALE";
  dateOfBirth?: string;
  hasPhoto: boolean;
  classId?: string;
  className?: string;
  levelName?: string;
  sessionId?: string;
  sessionName?: string;
  currentTermId?: string;
  currentTermName?: string;
  branchId: string;
  schoolId: string;
  schoolName: string;
}

/**
 * Mirrors backend student.application.port.in.StudentTermView. `resultsPublished`/
 * `midtermPublished` are independent (Phase 17), the `WardTermView` shape.
 */
export interface StudentTermView {
  sessionId: string;
  sessionName: string;
  currentSession: boolean;
  termId: string;
  termName: string;
  termNumber: number;
  classId: string;
  className?: string;
  levelId?: string;
  resultsPublished: boolean;
  midtermPublished: boolean;
}

/** The calling student's own profile. */
export function getMyStudent(): Promise<MyStudentView> {
  return apiFetch<MyStudentView>(`${BASE}/student`);
}

/** Every term the caller has ever been enrolled for, across every session - not pre-filtered to published ones. */
export function listMyTerms(): Promise<StudentTermView[]> {
  return apiFetch<StudentTermView[]>(`${BASE}/terms`);
}

/** The caller's own class timetable for one term, read-only - not publication-gated, like the guardian ward equivalent. */
export function getMyClassTimetable(termId: string): Promise<ClassTimetableView> {
  return apiFetch<ClassTimetableView>(`${BASE}/class-timetable?termId=${termId}`);
}

/**
 * The caller's own photo bytes - a STUDENT has no access to `/api/v1/files/**` at all, so this is
 * the only path to them (CLAUDE.md's Domain Rules). 404s when the student has no photo set.
 */
export function downloadMyPhoto(): Promise<Blob> {
  return apiFetchBlob(`${BASE}/student/photo`);
}

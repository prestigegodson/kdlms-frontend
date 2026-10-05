import { apiFetch } from "@/api/client";

/**
 * A creator's learner roster and class enrollments (creators.md Phase C5) - mirrors backend
 * virtualclass.application.port.in.LearnerView / ManageLearnersUseCase / ManageEnrollmentsUseCase.
 */

export type LearnerKind = "ADULT" | "MINOR_WITH_GUARDIAN" | "MINOR_WITH_LOGIN";
export type LearnerStatus = "ACTIVE" | "INVITED" | "INVITE_EXPIRED";

export interface LearnerGuardianRef {
  userId: string;
  name: string;
  email: string | null;
}

export interface LearnerClassRef {
  id: string;
  name: string;
}

export interface Learner {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
  minor: boolean;
  kind: LearnerKind;
  status: LearnerStatus;
  /** The adult's own email, or a minor's guardian's; null for a minor with a login id. */
  email: string | null;
  /** The generated login id of a minor who signs in themselves. */
  loginId: string | null;
  guardians: LearnerGuardianRef[];
  classes: LearnerClassRef[];
  inviteExpiresAt: string | null;
  /** False while another creator also has this learner - their details are then read-only. */
  editable: boolean;
  addedAt: string;
}

export interface LearnerRoster {
  learners: Learner[];
  /** A minor's email is their guardian's (true), or a login id is generated instead (false). */
  guardianAccess: boolean;
  maxStudentsPerClass: number | null;
}

export interface AddLearnerInput {
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
  minor: boolean;
  email: string | null;
  classIds: string[];
}

export interface LearnerCredentials {
  loginId: string;
  temporaryPassword: string;
}

export interface AddLearnerResult {
  learner: Learner;
  /** Only for a minor given a generated login - the one time the password is shown. */
  credentials: LearnerCredentials | null;
}

export interface ClassRosterEntry {
  learnerId: string;
  firstName: string;
  lastName: string;
  minor: boolean;
  kind: LearnerKind;
  enrolledAt: string;
  /** Enrolled beyond the plan's students-per-class limit (newest first). */
  overLimit: boolean;
}

export interface ClassRoster {
  classId: string;
  maxStudentsPerClass: number | null;
  activeCount: number;
  learners: ClassRosterEntry[];
}

const BASE = "/api/v1/learners";

export function listLearners(): Promise<LearnerRoster> {
  return apiFetch<LearnerRoster>(BASE);
}

export function addLearner(input: AddLearnerInput): Promise<AddLearnerResult> {
  return apiFetch<AddLearnerResult>(BASE, { method: "POST", body: JSON.stringify(input) });
}

export function updateLearner(
  id: string,
  input: { firstName: string; lastName: string; dateOfBirth: string | null },
): Promise<Learner> {
  return apiFetch<Learner>(`${BASE}/${id}`, { method: "PUT", body: JSON.stringify(input) });
}

export function removeLearner(id: string): Promise<void> {
  return apiFetch<void>(`${BASE}/${id}`, { method: "DELETE" });
}

export function resendLearnerInvite(id: string): Promise<{ learner: Learner }> {
  return apiFetch<{ learner: Learner }>(`${BASE}/${id}/invite/resend`, { method: "POST" });
}

export function resetLearnerPassword(id: string): Promise<LearnerCredentials> {
  return apiFetch<LearnerCredentials>(`${BASE}/${id}/password/reset`, { method: "POST" });
}

export function getClassRoster(classId: string): Promise<ClassRoster> {
  return apiFetch<ClassRoster>(`/api/v1/virtual-classes/${classId}/enrollments`);
}

export function enrollLearners(classId: string, learnerIds: string[]): Promise<ClassRoster> {
  return apiFetch<ClassRoster>(`/api/v1/virtual-classes/${classId}/enrollments`, {
    method: "POST",
    body: JSON.stringify({ learnerIds }),
  });
}

export function unenrollLearner(classId: string, learnerId: string): Promise<void> {
  return apiFetch<void>(`/api/v1/virtual-classes/${classId}/enrollments/${learnerId}`, { method: "DELETE" });
}

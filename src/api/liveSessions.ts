import { apiFetch } from "@/api/client";
import type { OccurrenceStatus } from "@/api/virtualClasses";

/**
 * Live sessions over LiveKit (creators.md Phase C6) - mirrors backend
 * virtualclass.application.port.in.JoinLiveSessionUseCase / SessionAttendanceUseCase. Instants are
 * ISO-8601 UTC.
 */

export type ParticipantRole = "CREATOR" | "LEARNER" | "GUARDIAN";

export interface JoinView {
  occurrenceId: string;
  className: string;
  scheduledStart: string;
  scheduledEnd: string;
  /** The LiveKit `wss://` URL to connect to with `token`. */
  serverUrl: string;
  token: string;
  roomName: string;
  role: ParticipantRole;
  /** When `token` stops admitting the caller - the session's remaining allowed time. */
  expiresAt: string;
}

export interface LearnerAttendanceRow {
  learnerId: string;
  firstName: string;
  lastName: string;
  /** False for a learner who joined but has since been removed from the class. */
  enrolled: boolean;
  present: boolean;
  minutes: number;
  firstJoinedAt: string | null;
}

export interface ObserverRow {
  userId: string;
  name: string;
  minutes: number;
  firstJoinedAt: string | null;
}

export interface OccurrenceAttendance {
  occurrenceId: string;
  classId: string;
  className: string;
  scheduledStart: string;
  scheduledEnd: string;
  status: OccurrenceStatus;
  startedAt: string | null;
  endedAt: string | null;
  learners: LearnerAttendanceRow[];
  observers: ObserverRow[];
}

export interface SessionAttendanceRow {
  occurrenceId: string;
  scheduledStart: string;
  scheduledEnd: string;
  status: OccurrenceStatus;
  present: boolean;
  minutes: number;
  firstJoinedAt: string | null;
}

export interface AttendanceHistory {
  classId: string;
  className: string;
  learnerId: string;
  firstName: string;
  lastName: string;
  sessionsHeld: number;
  sessionsAttended: number;
  /** Newest first. */
  sessions: SessionAttendanceRow[];
}

/** The data message the server sends a live room 5 minutes before the plan's session length runs out. */
export interface SessionEndingMessage {
  type: "session-ending";
  minutesLeft: number;
}

export function joinLiveSession(occurrenceId: string): Promise<JoinView> {
  return apiFetch<JoinView>(`/api/v1/virtual-classes/occurrences/${occurrenceId}/join`, { method: "POST" });
}

export function getOccurrenceAttendance(occurrenceId: string): Promise<OccurrenceAttendance> {
  return apiFetch<OccurrenceAttendance>(`/api/v1/virtual-classes/occurrences/${occurrenceId}/attendance`);
}

export function getLearnerAttendance(classId: string, learnerId: string): Promise<AttendanceHistory> {
  return apiFetch<AttendanceHistory>(`/api/v1/virtual-classes/${classId}/learners/${learnerId}/attendance`);
}

export function getMyClassAttendance(classId: string): Promise<AttendanceHistory> {
  return apiFetch<AttendanceHistory>(`/api/v1/learner/classes/${classId}/attendance`);
}

export function getWardClassAttendance(learnerId: string, classId: string): Promise<AttendanceHistory> {
  return apiFetch<AttendanceHistory>(`/api/v1/me/online-classes/${learnerId}/classes/${classId}/attendance`);
}

/** Parses a live room data message, ignoring anything that isn't the session-ending warning (e.g. chat). */
export function parseSessionEnding(payload: Uint8Array): SessionEndingMessage | null {
  try {
    const message = JSON.parse(new TextDecoder().decode(payload)) as Partial<SessionEndingMessage>;
    return message.type === "session-ending" && typeof message.minutesLeft === "number"
      ? { type: "session-ending", minutesLeft: message.minutesLeft }
      : null;
  } catch {
    return null;
  }
}

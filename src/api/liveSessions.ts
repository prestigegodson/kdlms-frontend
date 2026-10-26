import { apiFetch } from "@/api/client";
import type { MeetingMode, MeetingProvider, OccurrenceStatus } from "@/api/virtualClasses";

/**
 * Live sessions over LiveKit (creators.md Phase C6) - mirrors backend
 * virtualclass.application.port.in.JoinLiveSessionUseCase / SessionAttendanceUseCase. Instants are
 * ISO-8601 UTC.
 */

export type ParticipantRole = "CREATOR" | "LEARNER" | "GUARDIAN";

/**
 * `meetingMode` says which half is set: PLATFORM fills `serverUrl`/`token`/`roomName`/`expiresAt`,
 * EXTERNAL fills `meetingUrl`/`meetingProvider` - the only place a learner ever gets the link.
 */
export interface JoinView {
  occurrenceId: string;
  className: string;
  scheduledStart: string;
  scheduledEnd: string;
  /** The LiveKit `wss://` URL to connect to with `token`. */
  serverUrl: string | null;
  token: string | null;
  roomName: string | null;
  role: ParticipantRole;
  /** When `token` stops admitting the caller - the session's remaining allowed time. */
  expiresAt: string | null;
  meetingMode: MeetingMode;
  meetingUrl: string | null;
  meetingProvider: MeetingProvider | null;
}

/** A LiveKit-room session whose creator's plan no longer includes Platform Video Conferencing. */
export const MEETING_LINK_REQUIRED_PROBLEM = "https://kdlms.com/problems/meeting-link-required";

export interface LearnerAttendanceRow {
  learnerId: string;
  firstName: string;
  lastName: string;
  /** False for a learner who joined but has since been removed from the class. */
  enrolled: boolean;
  present: boolean;
  minutes: number;
  firstJoinedAt: string | null;
  /** Joined through the session's external Google Meet/Zoom link - present, but no minutes tracked. */
  viaLink: boolean;
}

export interface ObserverRow {
  userId: string;
  name: string;
  minutes: number;
  firstJoinedAt: string | null;
  viaLink: boolean;
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
  viaLink: boolean;
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

/** The creator ends the session for everyone: the room closes and nobody can rejoin. */
export function endLiveSession(occurrenceId: string): Promise<void> {
  return apiFetch<void>(`/api/v1/virtual-classes/occurrences/${occurrenceId}/end`, { method: "POST" });
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

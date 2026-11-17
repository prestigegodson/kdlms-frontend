import { apiFetch, apiFetchBlob } from "@/api/client";
import type {
  MeetingMode,
  MeetingProvider,
  OccurrenceStatus,
  ScheduleSlot,
} from "@/api/virtualClasses";

/**
 * A learner's own online classes and a guardian's learners' classes, across every creator
 * (creators.md Phase C5) - mirrors backend virtualclass.application.port.in.MyOnlineClassesUseCase.
 * Slot times are local to the class's `timezone`; session instants are ISO-8601 UTC.
 */

export interface OnlineSession {
  id: string;
  scheduledStart: string;
  scheduledEnd: string;
  status: OccurrenceStatus;
  cancelReason: string | null;
  /** The session can be entered right now (Phase C6). */
  joinable: boolean;
  /** Where it is held - never the link itself, which only the join call hands out. */
  meetingMode: MeetingMode;
  meetingProvider: MeetingProvider | null;
  /** The creator hasn't given this session a meeting link yet. */
  linkMissing: boolean;
}

export interface OnlineClass {
  id: string;
  name: string;
  description: string | null;
  subjectLabel: string | null;
  creatorName: string | null;
  /** The creator's IANA timezone; null only while the creator has no profile. */
  timezone: string | null;
  startDate: string;
  endDate: string | null;
  slots: ScheduleSlot[];
  /** The next 14 days' sessions, earliest first. */
  upcoming: OnlineSession[];
  /** Whether the viewer gets this class's session reminder emails (Phase C7). */
  remindersEnabled: boolean;
  /** The tutor's tenant id, for {@link creatorImagePath}. */
  creatorId: string;
  /** Changes whenever the tutor's logo does; null when they have none. */
  creatorLogoVersion: string | null;
  /** Changes whenever the tutor's banner does; null when they have none. */
  creatorBannerVersion: string | null;
}

export interface LearnerOnlineClasses {
  learnerId: string;
  firstName: string;
  lastName: string;
  classes: OnlineClass[];
}

export function listMyOnlineClasses(): Promise<OnlineClass[]> {
  return apiFetch<OnlineClass[]>("/api/v1/learner/classes");
}

export function listWardOnlineClasses(): Promise<LearnerOnlineClasses[]> {
  return apiFetch<LearnerOnlineClasses[]>("/api/v1/me/online-classes");
}

/**
 * One of the viewer's next sessions, for the dashboard's "Upcoming sessions" panel (Phase C7).
 * `learnerNames` is empty on a learner's own list and names the guardian's learners otherwise.
 */
export interface UpcomingSession {
  id: string;
  classId: string;
  className: string;
  creatorName: string | null;
  timezone: string | null;
  learnerNames: string[];
  scheduledStart: string;
  scheduledEnd: string;
  status: OccurrenceStatus;
  joinable: boolean;
  meetingMode: MeetingMode;
  meetingProvider: MeetingProvider | null;
  linkMissing: boolean;
}

export interface ReminderPreference {
  classId: string;
  remindersEnabled: boolean;
}

export function listMyUpcomingSessions(): Promise<UpcomingSession[]> {
  return apiFetch<UpcomingSession[]>("/api/v1/learner/upcoming-sessions");
}

export function listWardUpcomingSessions(): Promise<UpcomingSession[]> {
  return apiFetch<UpcomingSession[]>("/api/v1/me/online-classes/upcoming");
}

export function setMyClassReminders(classId: string, enabled: boolean): Promise<ReminderPreference> {
  return apiFetch<ReminderPreference>(`/api/v1/learner/classes/${classId}/reminders`, {
    method: "PUT",
    body: JSON.stringify({ enabled }),
  });
}

export function setWardClassReminders(classId: string, enabled: boolean): Promise<ReminderPreference> {
  return apiFetch<ReminderPreference>(`/api/v1/me/online-classes/classes/${classId}/reminders`, {
    method: "PUT",
    body: JSON.stringify({ enabled }),
  });
}

export type CreatorImageKind = "logo" | "banner";

/**
 * Where a tutor's logo or banner is read from - a narrow learner/guardian endpoint, since neither
 * role can reach `/api/v1/files`. `version` only busts the cache when the tutor changes the image.
 */
export function creatorImagePath(
  viewer: "learner" | "guardian",
  creatorId: string,
  kind: CreatorImageKind,
  version: string,
): string {
  const base = viewer === "learner" ? "/api/v1/learner/creators" : "/api/v1/me/online-classes/creators";
  return `${base}/${creatorId}/${kind}?v=${encodeURIComponent(version)}`;
}

/** The `useObjectUrl` fetcher for a {@link creatorImagePath}. */
export function fetchCreatorImage(path: string): Promise<Blob> {
  return apiFetchBlob(path);
}

import { apiFetch } from "@/api/client";

/**
 * The creator's virtual classes, weekly schedules and sessions (creators.md Phase C4). Mirrors
 * backend virtualclass.application.port.in.* - slot times are local to the creator's profile
 * timezone; session instants are ISO-8601 UTC.
 */

export type VirtualClassStatus = "ACTIVE" | "ARCHIVED";
export type OccurrenceStatus = "SCHEDULED" | "RESCHEDULED" | "CANCELLED" | "LIVE" | "ENDED";

/** 1 = Monday .. 7 = Sunday (java.time.DayOfWeek). */
export type DayOfWeek = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface ScheduleSlot {
  id: string;
  dayOfWeek: DayOfWeek;
  /** "HH:mm" or "HH:mm:ss". */
  startTime: string;
  durationMinutes: number;
}

export interface VirtualClass {
  id: string;
  name: string;
  description: string | null;
  subjectLabel: string | null;
  status: VirtualClassStatus;
  startDate: string;
  endDate: string | null;
  /** An ACTIVE class beyond the plan's class limit - read-only until there is room. */
  overLimit: boolean;
  slots: ScheduleSlot[];
  createdAt: string;
}

export interface VirtualClassList {
  classes: VirtualClass[];
  /** `null` = unlimited. */
  maxClasses: number | null;
  activeCount: number;
  timezone: string | null;
}

export interface VirtualClassInput {
  name: string;
  description: string | null;
  subjectLabel: string | null;
  startDate: string;
  endDate: string | null;
}

export interface SlotInput {
  /** Present for an existing slot (keeps its rescheduled/cancelled sessions attached). */
  id?: string;
  dayOfWeek: DayOfWeek;
  startTime: string;
  durationMinutes: number;
}

export interface ClashWarning {
  dayOfWeek: DayOfWeek;
  startTime: string;
  durationMinutes: number;
  otherClassId: string;
  otherClassName: string;
  message: string;
}

export interface ScheduleSaveOutcome {
  virtualClass: VirtualClass;
  warnings: ClashWarning[];
}

export interface Occurrence {
  id: string;
  classId: string;
  className: string;
  slotId: string | null;
  scheduledStart: string;
  scheduledEnd: string;
  originalStart: string;
  status: OccurrenceStatus;
  cancelReason: string | null;
  /** Rescheduled, cancelled or one-off - schedule edits leave it alone. */
  overridden: boolean;
  editable: boolean;
  /** The live room can be entered right now (Phase C6) - the join window, and the class within the plan. */
  joinable: boolean;
  /** When the live room actually started/finished, or null. */
  startedAt: string | null;
  endedAt: string | null;
}

export interface OccurrenceCalendar {
  timezone: string;
  occurrences: Occurrence[];
}

export interface SessionTimeInput {
  date: string;
  startTime: string;
  durationMinutes: number;
}

const BASE = "/api/v1/virtual-classes";

export const PLAN_LIMIT_REACHED_PROBLEM = "https://kdlms.com/problems/plan-limit-reached";
export const CLASS_OVER_LIMIT_PROBLEM = "https://kdlms.com/problems/class-over-limit";

export function listVirtualClasses(): Promise<VirtualClassList> {
  return apiFetch<VirtualClassList>(BASE);
}

export function getVirtualClass(id: string): Promise<VirtualClass> {
  return apiFetch<VirtualClass>(`${BASE}/${id}`);
}

export function createVirtualClass(input: VirtualClassInput): Promise<VirtualClass> {
  return apiFetch<VirtualClass>(BASE, { method: "POST", body: JSON.stringify(input) });
}

export function updateVirtualClass(id: string, input: VirtualClassInput): Promise<VirtualClass> {
  return apiFetch<VirtualClass>(`${BASE}/${id}`, { method: "PUT", body: JSON.stringify(input) });
}

export function archiveVirtualClass(id: string): Promise<VirtualClass> {
  return apiFetch<VirtualClass>(`${BASE}/${id}/archive`, { method: "POST" });
}

export function restoreVirtualClass(id: string): Promise<VirtualClass> {
  return apiFetch<VirtualClass>(`${BASE}/${id}/restore`, { method: "POST" });
}

export function deleteVirtualClass(id: string): Promise<void> {
  return apiFetch<void>(`${BASE}/${id}`, { method: "DELETE" });
}

export function saveSchedule(id: string, slots: SlotInput[]): Promise<ScheduleSaveOutcome> {
  return apiFetch<ScheduleSaveOutcome>(`${BASE}/${id}/schedule`, {
    method: "PUT",
    body: JSON.stringify({ slots }),
  });
}

export function listOccurrences(
  from: string,
  to: string,
  classId?: string,
): Promise<OccurrenceCalendar> {
  const params = new URLSearchParams({ from, to });
  if (classId) params.set("classId", classId);
  return apiFetch<OccurrenceCalendar>(`${BASE}/occurrences?${params.toString()}`);
}

/** The creator dashboard's next sessions - live or within 7 days, not cancelled, at most 10 (Phase C7). */
export function listUpcomingOccurrences(): Promise<OccurrenceCalendar> {
  return apiFetch<OccurrenceCalendar>(`${BASE}/occurrences/upcoming`);
}

export function addOneOffSession(classId: string, input: SessionTimeInput): Promise<Occurrence> {
  return apiFetch<Occurrence>(`${BASE}/${classId}/occurrences`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function rescheduleSession(id: string, input: SessionTimeInput): Promise<Occurrence> {
  return apiFetch<Occurrence>(`${BASE}/occurrences/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ action: "RESCHEDULE", ...input }),
  });
}

export function cancelSession(id: string, reason: string | null): Promise<Occurrence> {
  return apiFetch<Occurrence>(`${BASE}/occurrences/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ action: "CANCEL", reason }),
  });
}

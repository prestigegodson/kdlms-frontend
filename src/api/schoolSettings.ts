import { apiFetch } from "@/api/client";

/** Mirrors backend school.application.port.in.ManageSchoolSettingsUseCase.SchoolSettingsView. */
export interface SchoolSettingsView {
  schoolId: string;
  allowWeekendAttendance: boolean;
  allowWeekendTimetable: boolean;
  /** Lets guardians read their wards' approved lesson notes. Off by default; also needs the Lesson notes plan feature. */
  guardianLessonNotesEnabled: boolean;
  /** Lets students change their own password. On by default; never blocks replacing a temporary password. */
  allowStudentPasswordChange: boolean;
  /** Takes a morning and an afternoon register each day. Off by default. */
  twoSessionAttendance: boolean;
}

/**
 * Mirrors backend ManageSchoolSettingsUseCase.ExistingAttendanceConversion -
 * what the current term's already-marked attendance becomes when
 * two-session attendance is turned on. Past terms are never touched.
 */
export type ExistingAttendanceConversion = "MORNING_AND_AFTERNOON" | "MORNING_ONLY";

/** A full replace, like the rest of this resource - omitting a field clears it. */
export interface SaveSchoolSettingsRequest {
  allowWeekendAttendance: boolean;
  allowWeekendTimetable: boolean;
  /** Lets guardians read their wards' approved lesson notes. Off by default; also needs the Lesson notes plan feature. */
  guardianLessonNotesEnabled: boolean;
  /** Lets students change their own password. On by default; never blocks replacing a temporary password. */
  allowStudentPasswordChange: boolean;
  twoSessionAttendance: boolean;
  /** Required when the save turns twoSessionAttendance on (the server 422s without it); ignored otherwise. */
  existingAttendanceConversion?: ExistingAttendanceConversion;
}

const BASE = "/api/v1/school/settings";

export function getSchoolSettings(): Promise<SchoolSettingsView> {
  return apiFetch<SchoolSettingsView>(BASE);
}

export function updateSchoolSettings(request: SaveSchoolSettingsRequest): Promise<SchoolSettingsView> {
  return apiFetch<SchoolSettingsView>(BASE, { method: "PUT", body: JSON.stringify(request) });
}

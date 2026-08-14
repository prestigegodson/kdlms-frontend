import { apiFetch } from "@/api/client";

/** Mirrors backend school.application.port.in.ManageSchoolSettingsUseCase.SchoolSettingsView. */
export interface SchoolSettingsView {
  schoolId: string;
  allowWeekendAttendance: boolean;
  allowWeekendTimetable: boolean;
}

/** A full replace, like the rest of this resource - omitting a field clears it. */
export interface SaveSchoolSettingsRequest {
  allowWeekendAttendance: boolean;
  allowWeekendTimetable: boolean;
}

const BASE = "/api/v1/school/settings";

export function getSchoolSettings(): Promise<SchoolSettingsView> {
  return apiFetch<SchoolSettingsView>(BASE);
}

export function updateSchoolSettings(request: SaveSchoolSettingsRequest): Promise<SchoolSettingsView> {
  return apiFetch<SchoolSettingsView>(BASE, { method: "PUT", body: JSON.stringify(request) });
}

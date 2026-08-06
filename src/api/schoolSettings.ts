import { apiFetch } from "@/api/client";

/** Mirrors backend school.application.port.in.ManageSchoolSettingsUseCase.SchoolSettingsView. */
export interface SchoolSettingsView {
  schoolId: string;
  allowWeekendAttendance: boolean;
}

export interface SaveSchoolSettingsRequest {
  allowWeekendAttendance: boolean;
}

const BASE = "/api/v1/school/settings";

export function getSchoolSettings(): Promise<SchoolSettingsView> {
  return apiFetch<SchoolSettingsView>(BASE);
}

export function updateSchoolSettings(request: SaveSchoolSettingsRequest): Promise<SchoolSettingsView> {
  return apiFetch<SchoolSettingsView>(BASE, { method: "PUT", body: JSON.stringify(request) });
}

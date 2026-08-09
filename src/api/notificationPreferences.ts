import { apiFetch } from "@/api/client";

/**
 * Mirrors backend student.application.port.in.MyNotificationPreferencesUseCase.SchoolPreference.
 * `communicationEmailsEnabled` lives on the per-school `guardians` row, so it's genuinely a
 * per-school setting - a guardian with wards at more than one school (CLAUDE.md's cross-school
 * guardian rule) gets one entry per school. Today this covers only communication-thread-started
 * email - results-published, guardian-invitation, and password-reset are unaffected and always
 * send. See CLAUDE.md's communication Domain Rules.
 */
export interface SchoolPreference {
  schoolId: string;
  schoolName: string;
  communicationEmailsEnabled: boolean;
}

export interface NotificationPreferencesView {
  schools: SchoolPreference[];
}

export interface UpdateNotificationPreferencesRequest {
  schoolId: string;
  communicationEmailsEnabled: boolean;
}

const BASE = "/api/v1/me/notification-preferences";

export function getMyNotificationPreferences(): Promise<NotificationPreferencesView> {
  return apiFetch<NotificationPreferencesView>(BASE);
}

export function updateMyNotificationPreferences(
  request: UpdateNotificationPreferencesRequest,
): Promise<NotificationPreferencesView> {
  return apiFetch<NotificationPreferencesView>(BASE, { method: "PUT", body: JSON.stringify(request) });
}

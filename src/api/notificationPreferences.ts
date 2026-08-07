import { apiFetch } from "@/api/client";

/**
 * Mirrors backend student.application.port.in.MyNotificationPreferencesUseCase.NotificationPreferencesView.
 * Today this covers only communication-thread-started email - results-published, guardian-invitation, and
 * password-reset are unaffected and always send. See CLAUDE.md's communication Domain Rules.
 */
export interface NotificationPreferencesView {
  communicationEmailsEnabled: boolean;
}

export interface UpdateNotificationPreferencesRequest {
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

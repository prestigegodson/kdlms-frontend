import { apiFetch } from "@/api/client";
import type { Role } from "@/api/types";

/** Mirrors backend identity.application.port.in.UserSummary. */
export interface UserSummary {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role: Role;
  schoolId?: string;
  branchId?: string;
  /** The image a printed result report's signature slot pulls for this user - undefined until set (Phase 7). */
  signatureFileId?: string;
  /**
   * True while this account is still holding a system-generated password
   * (admin-created staff/guardian, or an admin password-reset) and hasn't
   * replaced it yet. The server always sends this (it's a plain boolean,
   * never omitted); optional here only so the ~20 test files that build a
   * user fixture inline don't all need updating for a field their test
   * doesn't care about - undefined behaves as false everywhere it's read.
   * The server enforces this via PasswordChangeGuardFilter regardless of
   * what the frontend does with it - RequireRole reads this only to
   * redirect to /set-password before the user hits that 403.
   */
  mustChangePassword?: boolean;
}

export interface SessionResponse {
  accessToken: string;
  refreshToken: string;
  user: UserSummary;
}

export function login(email: string, password: string): Promise<SessionResponse> {
  return apiFetch<SessionResponse>("/api/v1/auth/login", {
    method: "POST",
    authenticated: false,
    body: JSON.stringify({ email, password }),
  });
}

export function refresh(refreshToken: string): Promise<SessionResponse> {
  return apiFetch<SessionResponse>("/api/v1/auth/refresh", {
    method: "POST",
    authenticated: false,
    body: JSON.stringify({ refreshToken }),
  });
}

export function logout(refreshToken: string): Promise<void> {
  return apiFetch<void>("/api/v1/auth/logout", {
    method: "POST",
    authenticated: false,
    body: JSON.stringify({ refreshToken }),
  });
}

export function me(): Promise<UserSummary> {
  return apiFetch<UserSummary>("/api/v1/auth/me");
}

export interface PasswordResetRequestedResponse {
  message: string;
  /** Only present when the backend has `kdlms.password-reset.expose-token` enabled. */
  token?: string;
}

export function requestPasswordReset(email: string): Promise<PasswordResetRequestedResponse> {
  return apiFetch<PasswordResetRequestedResponse>("/api/v1/auth/password-reset/request", {
    method: "POST",
    authenticated: false,
    body: JSON.stringify({ email }),
  });
}

export function confirmPasswordReset(token: string, newPassword: string): Promise<void> {
  return apiFetch<void>("/api/v1/auth/password-reset/confirm", {
    method: "POST",
    authenticated: false,
    body: JSON.stringify({ token, newPassword }),
  });
}

/** For an already-authenticated user; unlike password reset, this is sent with the bearer token attached. */
export function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  return apiFetch<void>("/api/v1/auth/change-password", {
    method: "POST",
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

/**
 * Replaces a system-generated temporary password with one the user chose -
 * no current-password field, since the caller only just authenticated with
 * the temporary one. Sent with the bearer token attached, like
 * changePassword above; the backend 422s unless the caller's
 * mustChangePassword flag is set. Returns a fresh session (new tokens, flag
 * cleared) so the caller can proceed straight into the app.
 */
export function setInitialPassword(newPassword: string): Promise<SessionResponse> {
  return apiFetch<SessionResponse>("/api/v1/auth/initial-password", {
    method: "POST",
    body: JSON.stringify({ newPassword }),
  });
}

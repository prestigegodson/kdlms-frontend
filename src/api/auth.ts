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

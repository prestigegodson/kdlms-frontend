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
  /**
   * False only for a self-registered CREATOR who hasn't followed their
   * verification link yet - drives the creator portal's verify banner; the
   * server refuses their writes (403 email-unverified) regardless. Optional
   * for the same test-fixture reason as mustChangePassword; undefined
   * behaves as true.
   */
  emailVerified?: boolean;
  /**
   * True only for a CREATOR who signed up with Google and hasn't filled in
   * their business profile yet - RequireRole redirects them to
   * /creator/complete-profile; the server refuses every other write (403
   * profile-incomplete) regardless. Optional for the same test-fixture
   * reason as mustChangePassword; undefined behaves as false.
   */
  profileIncomplete?: boolean;
  /**
   * False only for a STUDENT whose school has turned off "Allow students to
   * change password" - hides the account menu's Change password action; the
   * server refuses the change (403) regardless. Optional for the same
   * test-fixture reason as mustChangePassword; undefined behaves as true.
   */
  canChangePassword?: boolean;
}

export interface SessionResponse {
  accessToken: string;
  refreshToken: string;
  user: UserSummary;
}

/**
 * `identifier` is an email address for every role but STUDENT, or a
 * generated student login id for STUDENT (Phase 35A) - see the backend's
 * `shared.domain.LoginIdentifier`.
 * <p>
 * `subdomain` is the browser hostname's own subdomain label (see
 * `lib/host.ts`'s `resolveSchoolSubdomain`), passed explicitly since the
 * backend can't read it off the request `Host` header itself - the deployed
 * frontend calls a separate `api.kdlms.com` origin. Omit it (or pass
 * `null`/`undefined`) for the platform's own host, which imposes no
 * restriction. See `AuthenticationService#requireMatchingHost` (backend)
 * for what a school subdomain actually does with it.
 */
export function login(identifier: string, password: string, subdomain?: string | null): Promise<SessionResponse> {
  return apiFetch<SessionResponse>("/api/v1/auth/login", {
    method: "POST",
    authenticated: false,
    body: JSON.stringify({ identifier, password, subdomain: subdomain ?? null }),
  });
}

/** What a Google sign-in is for - mirrors the backend's GoogleAuthenticationUseCase.Intent. */
export type GoogleSignInIntent = "LOGIN" | "CREATOR_SIGNUP" | "ACCEPT_INVITE";

/**
 * Exchanges a Google Identity Services ID token for a KDLMS session. A LOGIN
 * for a Google account with no creator/guardian account behind it fails with
 * 401 `.../problems/google-account-not-found` (see GOOGLE_ACCOUNT_NOT_FOUND).
 */
export function googleSignIn(
  idToken: string,
  intent: GoogleSignInIntent,
  options: { inviteToken?: string; subdomain?: string | null } = {},
): Promise<SessionResponse> {
  return apiFetch<SessionResponse>("/api/v1/auth/google", {
    method: "POST",
    authenticated: false,
    body: JSON.stringify({
      idToken,
      intent,
      inviteToken: options.inviteToken ?? null,
      subdomain: options.subdomain ?? null,
    }),
  });
}

export const GOOGLE_ACCOUNT_NOT_FOUND = "https://kdlms.com/problems/google-account-not-found";

/** The sign-in options to offer - `googleClientId` is null while Google sign-in is off. */
export interface AuthConfig {
  googleClientId: string | null;
}

export function getAuthConfig(): Promise<AuthConfig> {
  return apiFetch<AuthConfig>("/api/v1/public/auth/config", { authenticated: false });
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

/**
 * Ends the caller's own current impersonation session (see api/users.ts's
 * `impersonate`) - only reachable while impersonating, per the backend's
 * `shared.config.ImpersonationGuardFilter`. authStore's `stopImpersonation`
 * restores the stashed system-admin session client-side afterward; this
 * call has nothing to hand back.
 */
export function stopImpersonation(): Promise<void> {
  return apiFetch<void>("/api/v1/auth/impersonation/stop", { method: "POST" });
}

/** Public - the token comes from the emailed /verify-email link. Refresh the session afterward to clear the gate. */
export function confirmEmailVerification(token: string): Promise<void> {
  return apiFetch<void>("/api/v1/auth/email-verification/confirm", {
    method: "POST",
    authenticated: false,
    body: JSON.stringify({ token }),
  });
}

/** Re-sends the signed-in creator's verification email. 429 inside the resend cooldown. */
export function resendEmailVerification(): Promise<{ token?: string }> {
  return apiFetch<{ token?: string }>("/api/v1/auth/email-verification/resend", { method: "POST" });
}

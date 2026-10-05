import { apiFetch } from "@/api/client";
import type { SessionResponse } from "@/api/auth";
import type { Role } from "@/api/types";

/**
 * Accepting an education creator's learner or guardian invite (creators.md Phase C5) - mirrors
 * backend identity.adapter.in.web.InviteController. Public: the invite token is the credential, so
 * it travels in the body rather than the URL path. Google acceptance is `googleSignIn` with intent
 * `ACCEPT_INVITE` instead.
 */
export interface InviteDetails {
  email: string;
  /** The account the invitee will hold - "LEARNER" or "GUARDIAN". */
  role: Role;
  learnerName: string;
  creatorName: string | null;
  firstName: string | null;
  lastName: string | null;
  /** The email already belongs to a KDLMS account. */
  accountExists: boolean;
  /** Accepting needs a new password - false when that account already has one. */
  passwordRequired: boolean;
  /** Accepting must name the new account (a guardian with no account yet). */
  nameRequired: boolean;
}

export interface InviteAcceptResponse {
  /** Accepted with no session: sign in with the existing password. */
  signInRequired: boolean;
  session: SessionResponse | null;
}

export function previewInvite(token: string): Promise<InviteDetails> {
  return apiFetch<InviteDetails>("/api/v1/auth/invites/preview", {
    method: "POST",
    authenticated: false,
    body: JSON.stringify({ token }),
  });
}

export function acceptInvite(input: {
  token: string;
  password?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}): Promise<InviteAcceptResponse> {
  return apiFetch<InviteAcceptResponse>("/api/v1/auth/invites/accept", {
    method: "POST",
    authenticated: false,
    body: JSON.stringify({
      token: input.token,
      password: input.password ?? null,
      firstName: input.firstName ?? null,
      lastName: input.lastName ?? null,
    }),
  });
}

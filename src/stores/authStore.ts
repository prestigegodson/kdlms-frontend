import { create } from "zustand";
import { persist } from "zustand/middleware";
import * as authApi from "@/api/auth";
import { setAccessTokenProvider, setRefreshHandler, setUnauthorizedHandler } from "@/api/client";
import type { Role } from "@/api/types";
import * as usersApi from "@/api/users";
import { useAcademicContextStore } from "@/stores/academicContextStore";
import { useBranchStore } from "@/stores/branchStore";
import { useFeatureStore } from "@/stores/featureStore";
import { usePendingLessonNotesStore } from "@/stores/pendingLessonNotesStore";
import { useSchoolBrandingStore } from "@/stores/schoolBrandingStore";
import { useSchoolSettingsStore } from "@/stores/schoolSettingsStore";
import { useStudentStore } from "@/stores/studentStore";
import { useTeacherScopeStore } from "@/stores/teacherScopeStore";
import { useUnreadMessagesStore } from "@/stores/unreadMessagesStore";
import { useWardStore } from "@/stores/wardStore";

export interface AuthenticatedUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  schoolId?: string;
  branchId?: string;
  /**
   * See api/auth.ts's UserSummary#mustChangePassword - optional for the
   * same reason (test fixtures), undefined behaves as false. RequireRole
   * reads this to redirect to /set-password.
   */
  mustChangePassword?: boolean;
}

type AuthStatus = "idle" | "authenticating";

/** What's shown on the impersonation banner/menu - see layouts/ImpersonationBanner.tsx. */
export interface ImpersonationInfo {
  sessionId: string;
  expiresAt: string;
  schoolName?: string;
}

/** The system admin's own session, set aside while impersonating so Stop can restore it exactly. */
interface StashedSession {
  user: AuthenticatedUser;
  accessToken: string;
  refreshToken: string;
}

interface AuthState {
  user: AuthenticatedUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  /** True once the persisted session has been read from storage - route guards wait on this to avoid a flash-redirect. */
  hydrated: boolean;
  status: AuthStatus;
  /** Non-null exactly while the current session is a system-admin impersonation session. */
  impersonation: ImpersonationInfo | null;
  /** The system admin's own tokens, stashed by startImpersonation and restored by stopImpersonation. */
  stashedSession: StashedSession | null;
  /**
   * Set when an impersonation session ends on its own (expired, or revoked
   * from elsewhere) rather than via an explicit Stop click - read once by
   * whatever notices it (see layouts/PortalShell.tsx) and cleared.
   */
  sessionNotice: string | null;

  /** Shaped for a successful login/refresh. */
  setSession: (session: {
    user: AuthenticatedUser;
    accessToken: string;
    refreshToken: string;
  }) => void;
  login: (identifier: string, password: string, subdomain?: string | null) => Promise<AuthenticatedUser>;
  logout: () => void;
  refreshSession: () => Promise<boolean>;
  setHydrated: () => void;
  /**
   * Signs the caller (a SYSTEM_ADMIN) in to `schoolId`'s portal as `userId`,
   * stashing the current session so `stopImpersonation` can restore it.
   * `reason` is a mandatory support note - see api/users.ts's `impersonate`.
   */
  startImpersonation: (schoolId: string, userId: string, reason: string) => Promise<void>;
  /**
   * Ends the current impersonation session and restores the stashed
   * system-admin session. Pass `{ expired: true }` when this is reacting to
   * a 401 (the session already ended server-side) rather than an explicit
   * Stop click - that skips the (otherwise-guaranteed-to-fail) call to the
   * backend and sets `sessionNotice` instead.
   */
  stopImpersonation: (options?: { expired?: boolean }) => Promise<void>;
  /** Dismisses `sessionNotice` - PortalShell calls this once the banner it renders has been shown. */
  clearSessionNotice: () => void;
}

/**
 * Every store scoped to "whichever school/session this tab is currently
 * signed in as" - reset on logout, and on either side of impersonation
 * (start/stop), so a system admin's own empty state never leaks into a
 * target admin's session or vice versa.
 */
function resetSessionScopedStores(): void {
  useTeacherScopeStore.getState().reset();
  useAcademicContextStore.getState().reset();
  useWardStore.getState().reset();
  useStudentStore.getState().reset();
  useSchoolSettingsStore.getState().reset();
  useFeatureStore.getState().reset();
  useSchoolBrandingStore.getState().reset();
  useUnreadMessagesStore.getState().reset();
  usePendingLessonNotesStore.getState().reset();
  useBranchStore.getState().reset();
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      hydrated: false,
      status: "idle",
      impersonation: null,
      stashedSession: null,
      sessionNotice: null,

      setSession: ({ user, accessToken, refreshToken }) => set({ user, accessToken, refreshToken }),

      login: async (identifier, password, subdomain) => {
        set({ status: "authenticating" });
        try {
          const session = await authApi.login(identifier, password, subdomain);
          set({
            user: session.user,
            accessToken: session.accessToken,
            refreshToken: session.refreshToken,
          });
          return session.user;
        } finally {
          set({ status: "idle" });
        }
      },

      logout: () => {
        const token = get().refreshToken;
        set({ user: null, accessToken: null, refreshToken: null, impersonation: null, stashedSession: null });
        // So a different user signing in next in this tab never inherits
        // the previous one's cached class/subject-teacher capabilities,
        // current-session/term label, linked wards, own student profile,
        // school settings, gated feature flags, brand mark, unread-messages
        // count, pending-lesson-note count, or selected branch.
        resetSessionScopedStores();
        if (token) {
          // Best-effort: the local session is already cleared either way.
          authApi.logout(token).catch(() => undefined);
        }
      },

      refreshSession: async () => {
        const token = get().refreshToken;
        if (!token) {
          return false;
        }
        try {
          const session = await authApi.refresh(token);
          set({
            user: session.user,
            accessToken: session.accessToken,
            refreshToken: session.refreshToken,
          });
          return true;
        } catch {
          set({ user: null, accessToken: null, refreshToken: null });
          return false;
        }
      },

      setHydrated: () => set({ hydrated: true }),

      startImpersonation: async (schoolId, userId, reason) => {
        const current = get();
        const session = await usersApi.impersonate(schoolId, userId, reason);
        const stashedSession: StashedSession | null =
          current.user && current.accessToken && current.refreshToken
            ? { user: current.user, accessToken: current.accessToken, refreshToken: current.refreshToken }
            : null;
        set({
          user: session.user,
          accessToken: session.accessToken,
          // Impersonation issues no refresh token - see api/users.ts's ImpersonationSession.
          refreshToken: null,
          stashedSession,
          impersonation: { sessionId: session.sessionId, expiresAt: session.expiresAt, schoolName: session.schoolName },
        });
        resetSessionScopedStores();
      },

      stopImpersonation: async (options) => {
        const stash = get().stashedSession;
        if (!options?.expired) {
          try {
            await authApi.stopImpersonation();
          } catch {
            // Best-effort, the same "local session is torn down either way" precedent as logout()
            // above - a network blip here shouldn't strand the system admin mid-impersonation.
          }
        }
        set({
          user: stash?.user ?? null,
          accessToken: stash?.accessToken ?? null,
          refreshToken: stash?.refreshToken ?? null,
          impersonation: null,
          stashedSession: null,
          sessionNotice: options?.expired
            ? "Your impersonation session ended. You're back in your own account."
            : null,
        });
        resetSessionScopedStores();
      },

      clearSessionNotice: () => set({ sessionNotice: null }),
    }),
    {
      name: "kdlms-auth",
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        impersonation: state.impersonation,
        stashedSession: state.stashedSession,
      }),
      onRehydrateStorage: () => (state) => state?.setHydrated(),
    },
  ),
);

/** Test helper: resets the store to its initial (logged-out, hydrated) state. */
export function resetAuthStore(): void {
  useAuthStore.setState({
    user: null,
    accessToken: null,
    refreshToken: null,
    hydrated: true,
    status: "idle",
    impersonation: null,
    stashedSession: null,
    sessionNotice: null,
  });
}

/**
 * Wires the API client's token/refresh/unauthorized seams to this store.
 * Call once from main.tsx - deliberately not a module-level side effect
 * like Phase 0's version was (that only ran because something else
 * happened to import this module first; a refactor could silently drop
 * auth headers by changing import order).
 * <p>
 * The unauthorized handler branches on whether the current session is an
 * impersonation one: a 401 there (the impersonation session itself ended -
 * Stop from elsewhere, expiry, or the target account changing underneath
 * it) restores the stashed system-admin session rather than logging out
 * entirely, since there's a perfectly good session to fall back to. There
 * is no refresh token to retry with either way (see `startImpersonation`),
 * so `refreshSession` already returns `false` first and this only fires
 * once that's failed.
 */
export function initAuth(): void {
  setAccessTokenProvider(() => useAuthStore.getState().accessToken);
  setRefreshHandler(() => useAuthStore.getState().refreshSession());
  setUnauthorizedHandler(() => {
    const state = useAuthStore.getState();
    if (state.impersonation) {
      state.stopImpersonation({ expired: true }).catch(() => undefined);
    } else {
      state.logout();
    }
  });
}

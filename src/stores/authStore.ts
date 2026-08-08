import { create } from "zustand";
import { persist } from "zustand/middleware";
import * as authApi from "@/api/auth";
import { setAccessTokenProvider, setRefreshHandler, setUnauthorizedHandler } from "@/api/client";
import type { Role } from "@/api/types";
import { useAcademicContextStore } from "@/stores/academicContextStore";
import { useFeatureStore } from "@/stores/featureStore";
import { useSchoolBrandingStore } from "@/stores/schoolBrandingStore";
import { useSchoolSettingsStore } from "@/stores/schoolSettingsStore";
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

interface AuthState {
  user: AuthenticatedUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  /** True once the persisted session has been read from storage - route guards wait on this to avoid a flash-redirect. */
  hydrated: boolean;
  status: AuthStatus;

  /** Shaped for a successful login/refresh. */
  setSession: (session: {
    user: AuthenticatedUser;
    accessToken: string;
    refreshToken: string;
  }) => void;
  login: (email: string, password: string) => Promise<AuthenticatedUser>;
  logout: () => void;
  refreshSession: () => Promise<boolean>;
  setHydrated: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      hydrated: false,
      status: "idle",

      setSession: ({ user, accessToken, refreshToken }) => set({ user, accessToken, refreshToken }),

      login: async (email, password) => {
        set({ status: "authenticating" });
        try {
          const session = await authApi.login(email, password);
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
        set({ user: null, accessToken: null, refreshToken: null });
        // So a different user signing in next in this tab never inherits
        // the previous one's cached class/subject-teacher capabilities,
        // current-session/term label, linked wards, school settings, gated
        // feature flags, brand mark, or unread-messages count.
        useTeacherScopeStore.getState().reset();
        useAcademicContextStore.getState().reset();
        useWardStore.getState().reset();
        useSchoolSettingsStore.getState().reset();
        useFeatureStore.getState().reset();
        useSchoolBrandingStore.getState().reset();
        useUnreadMessagesStore.getState().reset();
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
    }),
    {
      name: "kdlms-auth",
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
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
  });
}

/**
 * Wires the API client's token/refresh/unauthorized seams to this store.
 * Call once from main.tsx - deliberately not a module-level side effect
 * like Phase 0's version was (that only ran because something else
 * happened to import this module first; a refactor could silently drop
 * auth headers by changing import order).
 */
export function initAuth(): void {
  setAccessTokenProvider(() => useAuthStore.getState().accessToken);
  setRefreshHandler(() => useAuthStore.getState().refreshSession());
  setUnauthorizedHandler(() => useAuthStore.getState().logout());
}

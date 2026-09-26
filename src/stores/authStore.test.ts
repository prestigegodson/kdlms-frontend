import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as authApi from "@/api/auth";
import { apiFetch } from "@/api/client";
import * as usersApi from "@/api/users";
import { initAuth, resetAuthStore, useAuthStore } from "@/stores/authStore";
import { useStudentStore } from "@/stores/studentStore";

vi.mock("@/api/auth");
vi.mock("@/api/users");

const SYSTEM_ADMIN = {
  id: "sysadmin-1",
  email: "root@kdlms.com",
  firstName: "Root",
  lastName: "Admin",
  role: "SYSTEM_ADMIN",
} as const;

const USER = {
  id: "1",
  email: "a@b.com",
  firstName: "A",
  lastName: "B",
  role: "SCHOOL_ADMIN",
} as const;

describe("authStore", () => {
  beforeEach(() => {
    resetAuthStore();
    vi.clearAllMocks();
  });

  it("login stores the session on success", async () => {
    vi.mocked(authApi.login).mockResolvedValue({
      accessToken: "access-1",
      refreshToken: "refresh-1",
      user: USER,
    });

    const user = await useAuthStore.getState().login("a@b.com", "pw");

    expect(user).toEqual(USER);
    expect(useAuthStore.getState().accessToken).toBe("access-1");
    expect(useAuthStore.getState().status).toBe("idle");
  });

  it("login resets status to idle and rethrows on failure, without touching the session", async () => {
    vi.mocked(authApi.login).mockRejectedValue(new Error("bad credentials"));

    await expect(useAuthStore.getState().login("a@b.com", "wrong")).rejects.toThrow(
      "bad credentials",
    );

    expect(useAuthStore.getState().status).toBe("idle");
    expect(useAuthStore.getState().user).toBeNull();
  });

  it("refreshSession replaces the session on success", async () => {
    useAuthStore.setState({ refreshToken: "old-refresh" });
    vi.mocked(authApi.refresh).mockResolvedValue({
      accessToken: "access-2",
      refreshToken: "refresh-2",
      user: USER,
    });

    const ok = await useAuthStore.getState().refreshSession();

    expect(ok).toBe(true);
    expect(useAuthStore.getState().accessToken).toBe("access-2");
    expect(useAuthStore.getState().refreshToken).toBe("refresh-2");
  });

  it("refreshSession clears the session and returns false on failure", async () => {
    useAuthStore.setState({ refreshToken: "old-refresh", user: USER });
    vi.mocked(authApi.refresh).mockRejectedValue(new Error("expired"));

    const ok = await useAuthStore.getState().refreshSession();

    expect(ok).toBe(false);
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().refreshToken).toBeNull();
  });

  it("refreshSession short-circuits to false when there is no refresh token, without calling the API", async () => {
    const ok = await useAuthStore.getState().refreshSession();

    expect(ok).toBe(false);
    expect(authApi.refresh).not.toHaveBeenCalled();
  });

  it("logout resets the student store, so a different session in the same tab never inherits a stale profile", () => {
    vi.mocked(authApi.logout).mockResolvedValue(undefined);
    useAuthStore.setState({ user: { ...USER, role: "STUDENT" }, accessToken: "access", refreshToken: "refresh" });
    useStudentStore.setState({
      me: {
        studentId: "s1",
        fullName: "Grace Ward",
        admissionNumber: "KDL/24/001",
        gender: "FEMALE",
        hasPhoto: false,
        branchId: "b1",
        schoolId: "sch1",
        schoolName: "Portal School",
      },
      status: "loaded",
    });

    useAuthStore.getState().logout();

    expect(useAuthStore.getState().user).toBeNull();
    expect(useStudentStore.getState().me).toBeNull();
    expect(useStudentStore.getState().status).toBe("idle");
  });

  describe("impersonation", () => {
    beforeEach(() => {
      useAuthStore.setState({
        user: SYSTEM_ADMIN,
        accessToken: "sysadmin-access",
        refreshToken: "sysadmin-refresh",
      });
    });

    it("startImpersonation stashes the caller's own session and switches to the target's, with no refresh token", async () => {
      vi.mocked(usersApi.impersonate).mockResolvedValue({
        accessToken: "impersonation-access",
        sessionId: "session-1",
        expiresAt: "2026-01-01T01:00:00Z",
        schoolName: "Greenwood School",
        user: USER,
      });

      await useAuthStore.getState().startImpersonation("school-1", "admin-1", "Support ticket #123");

      const state = useAuthStore.getState();
      expect(usersApi.impersonate).toHaveBeenCalledWith("school-1", "admin-1", "Support ticket #123");
      expect(state.user).toEqual(USER);
      expect(state.accessToken).toBe("impersonation-access");
      expect(state.refreshToken).toBeNull();
      expect(state.impersonation).toEqual({
        sessionId: "session-1",
        expiresAt: "2026-01-01T01:00:00Z",
        schoolName: "Greenwood School",
      });
      expect(state.stashedSession).toEqual({
        user: SYSTEM_ADMIN,
        accessToken: "sysadmin-access",
        refreshToken: "sysadmin-refresh",
      });
    });

    it("stopImpersonation calls the backend and restores the stashed session", async () => {
      vi.mocked(authApi.stopImpersonation).mockResolvedValue(undefined);
      useAuthStore.setState({
        user: USER,
        accessToken: "impersonation-access",
        refreshToken: null,
        impersonation: { sessionId: "session-1", expiresAt: "2026-01-01T01:00:00Z" },
        stashedSession: { user: SYSTEM_ADMIN, accessToken: "sysadmin-access", refreshToken: "sysadmin-refresh" },
      });

      await useAuthStore.getState().stopImpersonation();

      expect(authApi.stopImpersonation).toHaveBeenCalledTimes(1);
      const state = useAuthStore.getState();
      expect(state.user).toEqual(SYSTEM_ADMIN);
      expect(state.accessToken).toBe("sysadmin-access");
      expect(state.refreshToken).toBe("sysadmin-refresh");
      expect(state.impersonation).toBeNull();
      expect(state.stashedSession).toBeNull();
      expect(state.sessionNotice).toBeNull();
    });

    it("stopImpersonation({ expired: true }) skips the backend call and sets a session notice", async () => {
      useAuthStore.setState({
        user: USER,
        accessToken: "impersonation-access",
        refreshToken: null,
        impersonation: { sessionId: "session-1", expiresAt: "2026-01-01T01:00:00Z" },
        stashedSession: { user: SYSTEM_ADMIN, accessToken: "sysadmin-access", refreshToken: "sysadmin-refresh" },
      });

      await useAuthStore.getState().stopImpersonation({ expired: true });

      expect(authApi.stopImpersonation).not.toHaveBeenCalled();
      const state = useAuthStore.getState();
      expect(state.user).toEqual(SYSTEM_ADMIN);
      expect(state.impersonation).toBeNull();
      expect(state.sessionNotice).toBe("Your impersonation session ended. You're back in your own account.");
    });

    it("initAuth's unauthorized handler restores the stashed session instead of logging out while impersonating", async () => {
      initAuth();
      useAuthStore.setState({
        accessToken: "expired-impersonation-token",
        refreshToken: null,
        user: USER,
        impersonation: { sessionId: "session-1", expiresAt: "2026-01-01T01:00:00Z" },
        stashedSession: { user: SYSTEM_ADMIN, accessToken: "sysadmin-access", refreshToken: "sysadmin-refresh" },
      });
      vi.stubGlobal(
        "fetch",
        vi.fn(() =>
          Promise.resolve({
            ok: false,
            status: 401,
            json: () => Promise.resolve({ detail: "This impersonation session has ended." }),
          }),
        ),
      );

      await expect(apiFetch("/api/v1/branches")).rejects.toThrow();

      // No refresh token means refreshSession() short-circuits to false first (see that test
      // above), so the unauthorized handler is what's under test here.
      const state = useAuthStore.getState();
      expect(state.user).toEqual(SYSTEM_ADMIN);
      expect(state.impersonation).toBeNull();
      expect(state.sessionNotice).toBe("Your impersonation session ended. You're back in your own account.");
      vi.unstubAllGlobals();
    });
  });

  describe("apiFetch integration (single-flight refresh)", () => {
    beforeEach(() => {
      initAuth();
      useAuthStore.setState({
        accessToken: "expired-token",
        refreshToken: "refresh-token",
        user: USER,
      });
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("refreshes exactly once for two concurrent 401s, then retries both requests with the new token", async () => {
      vi.mocked(authApi.refresh).mockResolvedValue({
        accessToken: "new-token",
        refreshToken: "new-refresh",
        user: USER,
      });

      // Any request bearing the (still) expired token is unauthorized; once the store
      // picks up the refreshed token, the same request succeeds - deterministic
      // regardless of exactly how the two concurrent requests/retries interleave.
      vi.stubGlobal(
        "fetch",
        vi.fn((_url: string, init?: RequestInit) => {
          const authorized = new Headers(init?.headers).get("Authorization") === "Bearer new-token";
          return Promise.resolve({
            ok: authorized,
            status: authorized ? 200 : 401,
            json: () => Promise.resolve(authorized ? { ok: true } : { detail: "Unauthorized" }),
          });
        }),
      );

      const [first, second] = await Promise.all([
        apiFetch("/api/v1/branches"),
        apiFetch("/api/v1/branches"),
      ]);

      expect(first).toEqual({ ok: true });
      expect(second).toEqual({ ok: true });
      expect(authApi.refresh).toHaveBeenCalledTimes(1);
    });

    it("logs out when refresh itself fails", async () => {
      vi.mocked(authApi.refresh).mockRejectedValue(new Error("expired"));
      vi.stubGlobal(
        "fetch",
        vi.fn(() =>
          Promise.resolve({
            ok: false,
            status: 401,
            json: () => Promise.resolve({ detail: "Unauthorized" }),
          }),
        ),
      );

      await expect(apiFetch("/api/v1/branches")).rejects.toThrow();

      expect(useAuthStore.getState().user).toBeNull();
      expect(useAuthStore.getState().accessToken).toBeNull();
    });
  });
});

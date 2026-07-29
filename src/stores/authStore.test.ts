import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as authApi from "@/api/auth";
import { apiFetch } from "@/api/client";
import { initAuth, resetAuthStore, useAuthStore } from "@/stores/authStore";

vi.mock("@/api/auth");

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

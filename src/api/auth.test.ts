import { afterEach, describe, expect, it, vi } from "vitest";
import { login } from "@/api/auth";

/**
 * Phase 35J: the transport-layer half of 35A.11's rename -
 * `LoginPage.test.tsx` proves the identifier field accepts a non-email
 * shape and reaches `authApi.login`, but mocks that module entirely, so
 * nothing proves the wire body's key is actually `identifier` (not the
 * pre-35A `email`). This exercises the real `login()` against a stubbed
 * `fetch` instead.
 */
describe("auth api - login", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubFetch() {
    const fetchMock = vi.fn((_input: RequestInfo | URL, _init?: RequestInit) =>
      Promise.resolve(
        new Response(JSON.stringify({ accessToken: "a", refreshToken: "r", user: {} }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  it("posts the identifier (email or student login id) under the `identifier` key, never `email`", async () => {
    const fetchMock = stubFetch();

    await login("grace-kdl24001", "TempPass123", null);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init?.body as string);
    expect(body).toEqual({ identifier: "grace-kdl24001", password: "TempPass123", subdomain: null });
    expect(body).not.toHaveProperty("email");
  });

  it("omits subdomain as null when not provided, for the platform's own host", async () => {
    const fetchMock = stubFetch();

    await login("admin@kdlms.com", "ChangeMe123!");

    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init?.body as string);
    expect(body.subdomain).toBeNull();
  });
});

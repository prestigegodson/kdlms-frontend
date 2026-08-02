import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiFetch, apiFetchBlob, apiFetchText, setAccessTokenProvider } from "@/api/client";

describe("apiFetch", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    setAccessTokenProvider(() => null);
  });

  it("resolves to undefined for a 204 No Content response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response(null, { status: 204 }))),
    );

    await expect(apiFetch("/api/v1/guardians/1/students/2", { method: "DELETE" })).resolves.toBeUndefined();
  });

  it("resolves to undefined for a 201 Created response with an empty body (regression: link-guardian bug)", async () => {
    // Mirrors POST /api/v1/guardians/{id}/students - a `void` @ResponseStatus(CREATED)
    // handler that sends no body at all. Previously this made apiFetch call
    // response.json() on an empty string, throwing a SyntaxError that the caller
    // couldn't distinguish from a real failure.
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response(null, { status: 201 }))),
    );

    await expect(apiFetch("/api/v1/guardians/1/students", { method: "POST" })).resolves.toBeUndefined();
  });

  it("parses a JSON body on a normal 200 response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ id: "abc" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        ),
      ),
    );

    await expect(apiFetch("/api/v1/branches")).resolves.toEqual({ id: "abc" });
  });

  it("throws an ApiError carrying the problem detail on a non-2xx response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ title: "Conflict", detail: "Already linked", status: 409 }), {
            status: 409,
            headers: { "Content-Type": "application/problem+json" },
          }),
        ),
      ),
    );

    const error = await apiFetch("/api/v1/guardians/1/students").catch((err: unknown) => err);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(409);
    expect((error as ApiError).message).toBe("Already linked");
    expect((error as ApiError).problem?.detail).toBe("Already linked");
  });

  it("falls back to the status text when a non-2xx response has no JSON body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response(null, { status: 500, statusText: "Internal Server Error" }))),
    );

    const error = await apiFetch("/api/v1/branches").catch((err: unknown) => err);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(500);
    expect((error as ApiError).message).toBe("Internal Server Error");
  });
});

describe("Accept header negotiation", () => {
  // Regression: reporting's /preview endpoints declare `produces = text/html`,
  // and buildHeaders used to force `Accept: application/json` on every
  // request via .set() - a 406 no caller could override. See client.ts's
  // buildHeaders/withDefaultAccept for the fix.

  afterEach(() => {
    vi.unstubAllGlobals();
    setAccessTokenProvider(() => null);
  });

  function stubFetch(body = "{}"): ReturnType<typeof vi.fn> {
    const fetchMock = vi.fn(() => Promise.resolve(new Response(body, { status: 200 })));
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  function acceptHeader(fetchMock: ReturnType<typeof vi.fn>): string | null {
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    return new Headers(init.headers).get("Accept");
  }

  it("apiFetch still defaults to Accept: application/json", async () => {
    const fetchMock = stubFetch();
    await apiFetch("/api/v1/branches");
    expect(acceptHeader(fetchMock)).toBe("application/json");
  });

  it("apiFetchText sends Accept: text/html, application/problem+json", async () => {
    const fetchMock = stubFetch();
    await apiFetchText("/api/v1/reports/students/1/preview?termId=2");
    expect(acceptHeader(fetchMock)).toBe("text/html, application/problem+json");
  });

  it("apiFetchBlob sends Accept: */*", async () => {
    const fetchMock = stubFetch();
    await apiFetchBlob("/api/v1/reports/students/1/pdf?termId=2");
    expect(acceptHeader(fetchMock)).toBe("*/*");
  });

  it("does not overwrite a caller-supplied Accept header", async () => {
    const fetchMock = stubFetch();
    await apiFetchText("/api/v1/reports/students/1/preview?termId=2", {
      headers: { Accept: "text/plain" },
    });
    expect(acceptHeader(fetchMock)).toBe("text/plain");
  });

  it("apiFetchText still throws a readable ApiError on a problem+json error response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ title: "Not Found", detail: "Student not found", status: 404 }), {
            status: 404,
            headers: { "Content-Type": "application/problem+json" },
          }),
        ),
      ),
    );

    const error = await apiFetchText("/api/v1/reports/students/missing/preview?termId=2").catch(
      (err: unknown) => err,
    );

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(404);
    expect((error as ApiError).problem?.detail).toBe("Student not found");
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiFetch, setAccessTokenProvider } from "@/api/client";

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

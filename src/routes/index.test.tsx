import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryRouter, RouterProvider } from "react-router";
import { routes } from "@/routes";
import { resetAuthStore, useAuthStore } from "@/stores/authStore";

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

describe("router", () => {
  beforeEach(() => {
    resetAuthStore();
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url.includes("/api/v1/health")) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve({
                status: "UP",
                application: "kdlms",
                version: "0.0.1-SNAPSHOT",
                timestamp: new Date().toISOString(),
              }),
          });
        }
        // Anything else (e.g. the system-admin schools list) gets a benign empty page,
        // so pages that fetch on mount don't crash rendering in these routing tests.
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 }),
        });
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("still serves the Phase 0 connectivity check at /status", async () => {
    renderAt("/status");

    expect(await screen.findByText("KDLMS")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/is/i)).toBeInTheDocument());
  });

  it("redirects an unauthenticated visitor from / to /login", async () => {
    renderAt("/");

    expect(await screen.findByText("Sign in to KDLMS")).toBeInTheDocument();
  });

  it("redirects a signed-in system admin from / to their portal home", async () => {
    useAuthStore.setState({
      user: {
        id: "1",
        email: "admin@kdlms.com",
        firstName: "Sys",
        lastName: "Admin",
        role: "SYSTEM_ADMIN",
      },
      accessToken: "access",
      refreshToken: "refresh",
    });

    renderAt("/");

    expect(await screen.findByRole("heading", { name: "Schools" })).toBeInTheDocument();
  });

  it("renders a 404 page for an unknown route", async () => {
    renderAt("/this-page-does-not-exist");

    expect(await screen.findByText("Page not found")).toBeInTheDocument();
  });
});

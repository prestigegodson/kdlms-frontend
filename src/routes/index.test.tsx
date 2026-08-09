import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryRouter, RouterProvider } from "react-router";
import { routes } from "@/routes";
import { resetAuthStore, useAuthStore } from "@/stores/authStore";
import { resetTeacherScopeStore } from "@/stores/teacherScopeStore";
import { resetWardStore } from "@/stores/wardStore";

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  return router;
}

describe("router", () => {
  beforeEach(() => {
    resetAuthStore();
    resetTeacherScopeStore();
    resetWardStore();
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

    expect(await screen.findByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
  });

  it("sends a signed-in but still-flagged system admin from / to /set-password, not their portal home", async () => {
    useAuthStore.setState({
      user: {
        id: "1",
        email: "admin@kdlms.com",
        firstName: "Sys",
        lastName: "Admin",
        role: "SYSTEM_ADMIN",
        mustChangePassword: true,
      },
      accessToken: "access",
      refreshToken: "refresh",
    });

    renderAt("/");

    expect(await screen.findByRole("heading", { name: "Set your password" })).toBeInTheDocument();
  });

  it("renders a 404 page for an unknown route", async () => {
    renderAt("/this-page-does-not-exist");

    expect(await screen.findByText("Page not found")).toBeInTheDocument();
  });

  describe("as a TEACHER", () => {
    beforeEach(() => {
      useAuthStore.setState({
        user: {
          id: "teacher-1",
          email: "teacher@school.example",
          firstName: "Tara",
          lastName: "T",
          role: "TEACHER",
          schoolId: "school-1",
          branchId: "branch-1",
        },
        accessToken: "access",
        refreshToken: "refresh",
      });
    });

    it("hides Sessions & Terms and Teachers from the sidebar, redirecting the sessions route to the dashboard", async () => {
      renderAt("/school/academics/sessions");

      expect(await screen.findByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
      expect(screen.queryByText("Sessions & Terms")).not.toBeInTheDocument();
      expect(screen.queryByText("Teachers")).not.toBeInTheDocument();
      expect(screen.queryByText("Branches")).not.toBeInTheDocument();
    });

    it("hides Attendance from the sidebar until capabilities load, then shows it only for a class teacher", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn((url: string) => {
          if (url.includes("/api/v1/me/capabilities")) {
            return Promise.resolve({
              ok: true,
              status: 200,
              json: () =>
                Promise.resolve({ isClassTeacher: true, classTeacherClassIds: ["c1"], subjectTeacherClassIds: [] }),
            });
          }
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 }),
          });
        }),
      );

      renderAt("/school");

      // Two occurrences once loaded: the sidebar link and MobileTabBar's own
      // copy (Attendance is TEACHER-primary - see SchoolLayout.tsx). Both are
      // always in the DOM; only CSS (untested here) picks one per viewport.
      expect(await screen.findAllByText("Attendance")).toHaveLength(2);
    });

    it("never shows Attendance for a subject-teacher-only account", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn((url: string) => {
          if (url.includes("/api/v1/me/capabilities")) {
            return Promise.resolve({
              ok: true,
              status: 200,
              json: () =>
                Promise.resolve({ isClassTeacher: false, classTeacherClassIds: [], subjectTeacherClassIds: ["c2"] }),
            });
          }
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 }),
          });
        }),
      );

      renderAt("/school");

      await screen.findByRole("heading", { name: "Dashboard" });
      expect(screen.queryByText("Attendance")).not.toBeInTheDocument();
    });
  });

  describe("as a GUARDIAN", () => {
    beforeEach(() => {
      useAuthStore.setState({
        user: {
          id: "guardian-1",
          email: "guardian@example.com",
          firstName: "Gina",
          lastName: "G",
          role: "GUARDIAN",
          schoolId: "school-1",
        },
        accessToken: "access",
        refreshToken: "refresh",
      });
      // The generic catch-all stub returns a Page-shaped body, but
      // GET /api/v1/me/wards returns a bare array - override it so
      // WardsPage doesn't crash trying to .map() over a Page object.
      vi.stubGlobal(
        "fetch",
        vi.fn((url: string) => {
          if (url.includes("/api/v1/me/wards")) {
            return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([]) });
          }
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 }),
          });
        }),
      );
    });

    it("shows the guardian nav and lands on My Wards", async () => {
      renderAt("/guardian");

      expect(await screen.findByRole("heading", { name: "My Wards" })).toBeInTheDocument();
      // Two occurrences each: the sidebar/drawer link and MobileTabBar's own
      // copy - every guardian nav item is tab-primary (see GuardianLayout.tsx).
      expect(screen.getAllByText("Results")).toHaveLength(2);
      expect(screen.getAllByText("Attendance")).toHaveLength(2);
    });

    it("is redirected away from /school to its own portal home", async () => {
      renderAt("/school");

      expect(await screen.findByRole("heading", { name: "My Wards" })).toBeInTheDocument();
    });
  });
});

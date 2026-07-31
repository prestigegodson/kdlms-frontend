import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it } from "vitest";
import type { NavItem } from "@/layouts/PortalShell";
import { PortalShell } from "@/layouts/PortalShell";
import { resetAuthStore, useAuthStore } from "@/stores/authStore";
import type { AuthenticatedUser } from "@/stores/authStore";

const USER: AuthenticatedUser = {
  id: "1",
  email: "admin@kdlms.com",
  firstName: "Ada",
  lastName: "Admin",
  role: "SCHOOL_ADMIN",
};

// Mirrors the school portal's real nav shape from SchoolLayout.tsx: an
// "Assessments" item whose href is a path prefix of "Grading systems"'s, and
// a "Classes" item with its own descendant detail route, so we can assert
// both the reported bug and the no-regression case in one nav set.
const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/school" },
  { label: "Classes", href: "/school/academics/classes" },
  { label: "Grading systems", href: "/school/assessments/grading", roles: ["SCHOOL_ADMIN"] },
  { label: "Assessments", href: "/school/assessments" },
  { label: "Students", href: "/school/students" },
];

function renderShellAt(pathname: string) {
  const router = createMemoryRouter(
    [{ path: "*", element: <PortalShell portalName="School" navItems={NAV_ITEMS} /> }],
    { initialEntries: [pathname] },
  );
  render(<RouterProvider router={router} />);
}

function currentLinkNames() {
  return screen
    .getAllByRole("link")
    .filter((link) => link.getAttribute("aria-current") === "page")
    .map((link) => link.textContent);
}

describe("PortalShell nav active state", () => {
  beforeEach(() => {
    resetAuthStore();
    useAuthStore.setState({ user: USER, accessToken: "t", refreshToken: "r" });
  });

  it("marks only Grading systems current on its own route, not Assessments", () => {
    renderShellAt("/school/assessments/grading");

    expect(currentLinkNames()).toEqual(["Grading systems"]);
  });

  it("marks only Grading systems current on a grading detail route", () => {
    renderShellAt("/school/assessments/grading/level-1");

    expect(currentLinkNames()).toEqual(["Grading systems"]);
  });

  it("marks Assessments current on its own route, not Grading systems", () => {
    renderShellAt("/school/assessments");

    expect(currentLinkNames()).toEqual(["Assessments"]);
  });

  it("keeps Classes current on a class detail route", () => {
    renderShellAt("/school/academics/classes/abc-123");

    expect(currentLinkNames()).toEqual(["Classes"]);
  });

  it("marks Dashboard current at the portal root", () => {
    renderShellAt("/school");
    expect(currentLinkNames()).toEqual(["Dashboard"]);
  });

  it("does not mark Dashboard current on other pages", () => {
    renderShellAt("/school/students");
    expect(currentLinkNames()).toEqual(["Students"]);
  });
});

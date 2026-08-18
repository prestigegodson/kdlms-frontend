import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type ReactNode, useState } from "react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PageHeader } from "@/components/ui/PageHeader";
import type { NavItem } from "@/layouts/PortalShell";
import { PortalShell } from "@/layouts/PortalShell";
import { resetAppBarStore } from "@/stores/appBarStore";
import { resetAuthStore, useAuthStore } from "@/stores/authStore";
import type { AuthenticatedUser } from "@/stores/authStore";
import { resetInstallPromptStore, useInstallPromptStore } from "@/stores/installPromptStore";
import { resetNavGroupsStore, useNavGroupsStore } from "@/stores/navGroupsStore";
import { resetSchoolBrandingStore, useSchoolBrandingStore } from "@/stores/schoolBrandingStore";

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
// Deliberately carries no `primary` - MobileTabBar renders nothing but
// "More" for it, so it can't interfere with the aria-current assertions
// below (see the "PortalShell tab bar" describe block for that coverage).
const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/school" },
  { label: "Classes", href: "/school/academics/classes" },
  { label: "Grading systems", href: "/school/assessments/grading", roles: ["SCHOOL_ADMIN"] },
  { label: "Assessments", href: "/school/assessments" },
  { label: "Students", href: "/school/students" },
];

function renderShell({
  pathname,
  items = NAV_ITEMS,
  children,
  defaultOpenGroups,
}: {
  pathname: string;
  items?: NavItem[];
  children?: ReactNode;
  defaultOpenGroups?: string[];
}) {
  const router = createMemoryRouter(
    [
      {
        path: "*",
        element: (
          <PortalShell portalName="School" navItems={items} defaultOpenGroups={defaultOpenGroups}>
            {children}
          </PortalShell>
        ),
      },
    ],
    { initialEntries: [pathname] },
  );
  render(<RouterProvider router={router} />);
}

function renderShellAt(pathname: string) {
  renderShell({ pathname });
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
    resetNavGroupsStore();
    resetInstallPromptStore();
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

describe("PortalShell brand mark", () => {
  beforeEach(() => {
    resetAuthStore();
    useAuthStore.setState({ user: USER, accessToken: "t", refreshToken: "r" });
    resetSchoolBrandingStore();
    resetNavGroupsStore();
    resetInstallPromptStore();
  });

  afterEach(() => {
    resetSchoolBrandingStore();
  });

  it("falls back to the KDLMS wordmark when the school has no logo", () => {
    renderShellAt("/school");

    expect(screen.getAllByText("KDLMS").length).toBeGreaterThan(0);
    expect(screen.queryByRole("img", { name: /logo/i })).not.toBeInTheDocument();
  });

  it("renders the school's logo instead of the wordmark once branding loads", () => {
    useSchoolBrandingStore.setState({
      schoolName: "Bright Star Academy",
      logoDataUri: "data:image/png;base64,AAAA",
      status: "loaded",
    });

    renderShellAt("/school");

    const logos = screen.getAllByRole("img", { name: "Bright Star Academy" });
    expect(logos.length).toBeGreaterThan(0);
    expect(screen.queryByText("KDLMS")).not.toBeInTheDocument();
  });
});

// A separate fixture from NAV_ITEMS above, deliberately exercising every
// selection rule at once: a 5th primary item past the 4-tab cap (Reports),
// an item with no `primary` at all (Guardians), one whose `primary` names a
// different role (Grading systems), and one PortalShell already filters out
// via `visible` before `primary` is ever consulted (Hidden).
const TAB_NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/school", primary: ["SCHOOL_ADMIN"] },
  { label: "Students", href: "/school/students", primary: ["SCHOOL_ADMIN"] },
  { label: "Assessments", href: "/school/assessments", primary: ["SCHOOL_ADMIN"] },
  { label: "Messages", href: "/school/messages", primary: ["SCHOOL_ADMIN"], badge: () => 3 },
  { label: "Reports", href: "/school/reports", primary: ["SCHOOL_ADMIN"] },
  { label: "Guardians", href: "/school/guardians" },
  { label: "Grading systems", href: "/school/assessments/grading", primary: ["SYSTEM_ADMIN"] },
  { label: "Hidden", href: "/school/hidden", primary: ["SCHOOL_ADMIN"], visible: () => false },
];

describe("PortalShell tab bar", () => {
  beforeEach(() => {
    resetAuthStore();
    useAuthStore.setState({ user: USER, accessToken: "t", refreshToken: "r" });
    resetNavGroupsStore();
    resetInstallPromptStore();
  });

  function tabBar() {
    return screen.getByRole("navigation", { name: "Primary" });
  }

  it("renders at most 4 primary tabs, in nav order, plus More", () => {
    renderShell({ pathname: "/school", items: TAB_NAV_ITEMS });

    const labels = within(tabBar())
      .getAllByRole("link")
      .map((link) => link.textContent);
    expect(labels).toEqual(["Dashboard", "Students", "Assessments", "Messages"]);
    expect(within(tabBar()).getByRole("button", { name: /More/ })).toBeInTheDocument();
  });

  it("excludes items with no primary, the wrong role's primary, or past the 4-tab cap - but keeps them in the drawer", () => {
    renderShell({ pathname: "/school", items: TAB_NAV_ITEMS });

    expect(within(tabBar()).queryByText("Guardians")).not.toBeInTheDocument();
    expect(within(tabBar()).queryByText("Grading systems")).not.toBeInTheDocument();
    expect(within(tabBar()).queryByText("Reports")).not.toBeInTheDocument();
    // Still reachable via the sidebar/drawer nav.
    expect(screen.getAllByText("Guardians").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Reports").length).toBeGreaterThan(0);
  });

  it("never shows an item visible() has already excluded, tab or otherwise", () => {
    renderShell({ pathname: "/school", items: TAB_NAV_ITEMS });

    expect(screen.queryByText("Hidden")).not.toBeInTheDocument();
  });

  it("omits the More tab entirely once every visible item already has a tab", () => {
    const items: NavItem[] = [
      { label: "Dashboard", href: "/admin", primary: ["SCHOOL_ADMIN"] },
      { label: "Schools", href: "/admin/schools", primary: ["SCHOOL_ADMIN"] },
    ];
    renderShell({ pathname: "/admin", items });

    expect(within(tabBar()).queryByRole("button", { name: /More/ })).not.toBeInTheDocument();
  });

  it("marks exactly one tab current, reusing PortalShell's shared activeHref", () => {
    renderShell({ pathname: "/school/students", items: TAB_NAV_ITEMS });

    const current = within(tabBar())
      .getAllByRole("link")
      .filter((link) => link.getAttribute("aria-current") === "page");
    expect(current.map((link) => link.textContent)).toEqual(["Students"]);
  });

  it("marks no tab current on a route that isn't one of the tabs", () => {
    renderShell({ pathname: "/school/assessments/grading", items: TAB_NAV_ITEMS });

    const current = within(tabBar())
      .getAllByRole("link")
      .filter((link) => link.getAttribute("aria-current") === "page");
    expect(current).toEqual([]);
  });

  it("renders a badge as a dot on the tab, keeping the numeric pill in the sidebar only", () => {
    renderShell({ pathname: "/school", items: TAB_NAV_ITEMS });

    expect(within(tabBar()).queryByText("3")).not.toBeInTheDocument();
    const sidebar = screen.getByRole("navigation", { name: "School navigation" });
    expect(within(sidebar).getByText("3")).toBeInTheDocument();
  });

  it("opens the drawer from More, locks body scroll, and returns focus to More on Escape", async () => {
    const user = userEvent.setup();
    renderShell({ pathname: "/school", items: TAB_NAV_ITEMS });
    const moreButton = within(tabBar()).getByRole("button", { name: /More/ });

    await user.click(moreButton);

    expect(screen.getByRole("dialog", { name: "School navigation" })).toBeInTheDocument();
    expect(document.body.style.overflow).toBe("hidden");

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe("");
    expect(moreButton).toHaveFocus();
  });

  it("no longer renders a standalone hamburger button - More is the one mobile nav affordance", () => {
    renderShellAt("/school");

    expect(screen.queryByRole("button", { name: "Open menu" })).not.toBeInTheDocument();
  });
});

describe("PortalShell mobile app bar", () => {
  beforeEach(() => {
    resetAuthStore();
    useAuthStore.setState({ user: USER, accessToken: "t", refreshToken: "r" });
    resetAppBarStore();
    resetNavGroupsStore();
    resetInstallPromptStore();
  });

  afterEach(() => {
    resetAppBarStore();
  });

  it("shows the mounted PageHeader's title and a back link to its backTo", async () => {
    renderShell({ pathname: "/school", children: <PageHeader title="Students" backTo="/school" /> });

    expect(await screen.findByRole("link", { name: "Back" })).toHaveAttribute("href", "/school");
    // PageHeader's own <h1> stays the one accessible heading at every width
    // (sr-only below `lg`) - the app bar's own copy is a decorative,
    // aria-hidden mirror, never a second heading.
    expect(screen.getByRole("heading", { name: "Students" })).toBeInTheDocument();
  });

  it("omits the back link when the PageHeader carries no backTo", async () => {
    renderShell({ pathname: "/school", children: <PageHeader title="Students" /> });

    expect(await screen.findByRole("heading", { name: "Students" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Back" })).not.toBeInTheDocument();
  });

  it("falls back to the brand mark when the page has no PageHeader", () => {
    renderShellAt("/school");

    expect(screen.getAllByText("KDLMS").length).toBeGreaterThan(0);
  });

  it("restores the brand mark once the PageHeader carrying the title unmounts", async () => {
    const user = userEvent.setup();

    function ToggleHeader() {
      const [show, setShow] = useState(true);
      return (
        <div>
          <button type="button" onClick={() => setShow(false)}>
            Hide header
          </button>
          {show && <PageHeader title="Students" backTo="/school" />}
        </div>
      );
    }

    renderShell({ pathname: "/school", children: <ToggleHeader /> });
    expect(await screen.findByRole("link", { name: "Back" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Hide header" }));

    expect(screen.queryByRole("link", { name: "Back" })).not.toBeInTheDocument();
    expect(screen.getAllByText("KDLMS").length).toBeGreaterThan(0);
  });
});

// Exercises the collapsible sidebar groups: Academics carries a badge item
// so a collapsed group's badge-dot rollup can be checked, People has no
// badge so it stays plain when collapsed, and Dashboard is ungrouped so it
// never gets a toggle button of its own.
const GROUPED_NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/school" },
  { label: "Classes", href: "/school/academics/classes", group: "Academics" },
  { label: "Messages", href: "/school/messages", group: "Academics", badge: () => 3 },
  { label: "Teachers", href: "/school/academics/teachers", group: "People" },
  { label: "Guardians", href: "/school/guardians", group: "People" },
];

describe("PortalShell collapsible sidebar groups", () => {
  beforeEach(() => {
    resetAuthStore();
    useAuthStore.setState({ user: USER, accessToken: "t", refreshToken: "r" });
    resetNavGroupsStore();
    resetInstallPromptStore();
  });

  function sidebar() {
    return screen.getByRole("navigation", { name: "School navigation" });
  }

  it("expands only the groups named in defaultOpenGroups", () => {
    renderShell({ pathname: "/school", items: GROUPED_NAV_ITEMS, defaultOpenGroups: ["Academics"] });

    const academics = within(sidebar()).getByRole("button", { name: /Academics/ });
    const people = within(sidebar()).getByRole("button", { name: /People/ });
    expect(academics).toHaveAttribute("aria-expanded", "true");
    expect(people).toHaveAttribute("aria-expanded", "false");
    expect(within(sidebar()).getByText("Classes")).toBeInTheDocument();
    expect(within(sidebar()).queryByText("Teachers")).not.toBeInTheDocument();
  });

  it("expands a group with no default that holds the active route", () => {
    renderShell({ pathname: "/school/guardians", items: GROUPED_NAV_ITEMS, defaultOpenGroups: ["Academics"] });

    const people = within(sidebar()).getByRole("button", { name: /People/ });
    expect(people).toHaveAttribute("aria-expanded", "true");
    expect(within(sidebar()).getByText("Guardians")).toBeInTheDocument();
  });

  it("toggles a group open on click and reveals its items", async () => {
    const user = userEvent.setup();
    renderShell({ pathname: "/school", items: GROUPED_NAV_ITEMS, defaultOpenGroups: ["Academics"] });

    const people = within(sidebar()).getByRole("button", { name: /People/ });
    expect(within(sidebar()).queryByText("Teachers")).not.toBeInTheDocument();

    await user.click(people);

    expect(people).toHaveAttribute("aria-expanded", "true");
    expect(within(sidebar()).getByText("Teachers")).toBeInTheDocument();
  });

  it("shows a badge dot on a collapsed group holding a badged item, not on one without", () => {
    renderShell({ pathname: "/school", items: GROUPED_NAV_ITEMS });

    const academics = within(sidebar()).getByRole("button", { name: /Academics/ });
    const people = within(sidebar()).getByRole("button", { name: /People/ });
    expect(academics.querySelector(".bg-brand-500")).not.toBeNull();
    expect(people.querySelector(".bg-brand-500")).toBeNull();
  });

  it("remembers an explicit toggle across a remount, overriding defaultOpenGroups", () => {
    useNavGroupsStore.getState().setCollapsed("School:Academics", true);

    renderShell({ pathname: "/school", items: GROUPED_NAV_ITEMS, defaultOpenGroups: ["Academics"] });

    const academics = within(sidebar()).getByRole("button", { name: /Academics/ });
    expect(academics).toHaveAttribute("aria-expanded", "false");
    expect(within(sidebar()).queryByText("Classes")).not.toBeInTheDocument();
  });
});

function fakeInstallEvent(): BeforeInstallPromptEvent {
  return {
    platforms: ["web"],
    prompt: vi.fn().mockResolvedValue(undefined),
    userChoice: Promise.resolve({ outcome: "accepted" as const, platform: "web" }),
  } as unknown as BeforeInstallPromptEvent;
}

describe("PortalShell drawer install entry", () => {
  beforeEach(() => {
    resetAuthStore();
    useAuthStore.setState({ user: USER, accessToken: "t", refreshToken: "r" });
    resetNavGroupsStore();
    resetInstallPromptStore();
  });

  it("omits Install app from the drawer when nothing is installable", async () => {
    const user = userEvent.setup();
    renderShell({ pathname: "/school", items: TAB_NAV_ITEMS });

    await user.click(screen.getByRole("button", { name: /More/ }));

    expect(screen.queryByRole("button", { name: "Install app" })).not.toBeInTheDocument();
  });

  it("shows Install app in the drawer once a beforeinstallprompt event has been deferred", async () => {
    const user = userEvent.setup();
    useInstallPromptStore.getState().setDeferredPrompt(fakeInstallEvent());
    renderShell({ pathname: "/school", items: TAB_NAV_ITEMS });

    await user.click(screen.getByRole("button", { name: /More/ }));

    expect(screen.getByRole("button", { name: "Install app" })).toBeInTheDocument();
  });

  it("closes the drawer and fires the native install dialog when Install app is tapped", async () => {
    const user = userEvent.setup();
    const event = fakeInstallEvent();
    useInstallPromptStore.getState().setDeferredPrompt(event);
    renderShell({ pathname: "/school", items: TAB_NAV_ITEMS });
    await user.click(screen.getByRole("button", { name: /More/ }));

    await user.click(screen.getByRole("button", { name: "Install app" }));

    expect(screen.queryByRole("dialog", { name: "School navigation" })).not.toBeInTheDocument();
    expect(event.prompt).toHaveBeenCalledOnce();
  });
});

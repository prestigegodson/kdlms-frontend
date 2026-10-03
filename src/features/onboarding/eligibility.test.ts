import { describe, expect, it } from "vitest";
import type { TourProgressView } from "@/api/onboarding";
import {
  isAvailable,
  isResolved,
  needsAutoStart,
  portalForPath,
  statusFor,
  stepsFor,
} from "@/features/onboarding/eligibility";
import type { TourDefinition } from "@/features/onboarding/types";

const TOUR: TourDefinition = {
  key: "school.students",
  version: 2,
  portal: "school",
  kind: "page",
  title: "Students",
  description: "",
  area: "People",
  roles: ["SCHOOL_ADMIN", "TEACHER"],
  route: "/school/students",
  navHref: "/school/students",
  steps: [
    { title: "Everyone", body: "" },
    { title: "Admins", body: "", roles: ["SCHOOL_ADMIN"] },
    { title: "Phones", body: "", only: "mobile" },
    { title: "Desktops", body: "", only: "desktop" },
  ],
};

function progress(overrides: Partial<TourProgressView>): TourProgressView {
  return { key: TOUR.key, version: 2, status: "COMPLETED", stepIndex: 0, updatedAt: "", ...overrides };
}

describe("statusFor", () => {
  it("is new with no saved progress", () => {
    expect(statusFor(TOUR, undefined)).toBe("new");
  });

  it("is updated when the saved progress is for an older version, whatever its status", () => {
    expect(statusFor(TOUR, progress({ version: 1, status: "COMPLETED" }))).toBe("updated");
    expect(statusFor(TOUR, progress({ version: 1, status: "SKIPPED" }))).toBe("updated");
  });

  it("maps the current version's saved status", () => {
    expect(statusFor(TOUR, progress({ status: "IN_PROGRESS" }))).toBe("in-progress");
    expect(statusFor(TOUR, progress({ status: "COMPLETED" }))).toBe("done");
    expect(statusFor(TOUR, progress({ status: "SKIPPED" }))).toBe("skipped");
  });
});

describe("needsAutoStart", () => {
  it("starts a new, part-done, or updated guide", () => {
    expect(needsAutoStart(TOUR, undefined, true, false)).toBe(true);
    expect(needsAutoStart(TOUR, progress({ status: "IN_PROGRESS" }), true, false)).toBe(true);
    expect(needsAutoStart(TOUR, progress({ version: 1 }), true, false)).toBe(true);
  });

  it("never re-starts a guide finished or skipped at its current version", () => {
    expect(needsAutoStart(TOUR, progress({ status: "COMPLETED" }), true, false)).toBe(false);
    expect(needsAutoStart(TOUR, progress({ status: "SKIPPED" }), true, false)).toBe(false);
  });

  it("never starts anything when guides are turned off or while impersonating", () => {
    expect(needsAutoStart(TOUR, undefined, false, false)).toBe(false);
    expect(needsAutoStart(TOUR, undefined, true, true)).toBe(false);
  });
});

describe("isResolved", () => {
  it("counts done or skipped at the current version only", () => {
    expect(isResolved(TOUR, progress({ status: "SKIPPED" }))).toBe(true);
    expect(isResolved(TOUR, progress({ status: "IN_PROGRESS" }))).toBe(false);
    expect(isResolved(TOUR, progress({ version: 1 }))).toBe(false);
    expect(isResolved(TOUR, undefined)).toBe(false);
  });
});

describe("isAvailable", () => {
  const context = { portal: "school" as const, role: "TEACHER" as const, visibleNavHrefs: new Set(["/school/students"]) };

  it("offers the guide when portal, role and nav item all line up", () => {
    expect(isAvailable(TOUR, context)).toBe(true);
  });

  it("hides the guide for another portal, another role, or a hidden nav item", () => {
    expect(isAvailable(TOUR, { ...context, portal: "guardian" })).toBe(false);
    expect(isAvailable(TOUR, { ...context, role: "BRANCH_ADMIN" })).toBe(false);
    expect(isAvailable(TOUR, { ...context, visibleNavHrefs: new Set() })).toBe(false);
  });
});

describe("stepsFor", () => {
  it("keeps role-tailored and screen-size steps only where they apply", () => {
    expect(stepsFor(TOUR, "SCHOOL_ADMIN", false).map((step) => step.title)).toEqual([
      "Everyone",
      "Admins",
      "Desktops",
    ]);
    expect(stepsFor(TOUR, "TEACHER", true).map((step) => step.title)).toEqual(["Everyone", "Phones"]);
  });
});

describe("portalForPath", () => {
  it("reads the portal from the first path segment", () => {
    expect(portalForPath("/school/students/")).toBe("school");
    expect(portalForPath("/guardian")).toBe("guardian");
    expect(portalForPath("/login")).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { shellTourFor, TOUR_KEY_PATTERN, TOURS } from "@/features/onboarding/tours/registry";

describe("onboarding guide registry", () => {
  it("has unique keys that the backend's TourKey accepts", () => {
    const keys = TOURS.map((tour) => tour.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const key of keys) {
      expect(key).toMatch(TOUR_KEY_PATTERN);
    }
  });

  it("gives every portal exactly one shell guide", () => {
    for (const portal of ["admin", "school", "guardian", "student"] as const) {
      expect(TOURS.filter((tour) => tour.portal === portal && tour.kind === "shell")).toHaveLength(1);
      expect(shellTourFor(portal)).toBeDefined();
    }
  });

  it("gives every page guide a route inside its own portal and at least one step", () => {
    for (const tour of TOURS) {
      expect(tour.steps.length).toBeGreaterThan(0);
      expect(tour.version).toBeGreaterThanOrEqual(1);
      if (tour.kind === "page") {
        expect(tour.route?.startsWith(`/${tour.portal}`)).toBe(true);
      }
    }
  });

  it("never has two page guides on the same route", () => {
    const routes = TOURS.filter((tour) => tour.kind === "page").map((tour) => tour.route);
    expect(new Set(routes).size).toBe(routes.length);
  });
});

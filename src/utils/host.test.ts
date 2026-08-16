import { afterEach, describe, expect, it, vi } from "vitest";
import { platformLoginUrl, resolveSchoolSubdomain } from "@/utils/host";

describe("resolveSchoolSubdomain", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("resolves the first label of a three-label production host", () => {
    expect(resolveSchoolSubdomain("greenwood.kdlms.com")).toBe("greenwood");
  });

  it("resolves a *.localhost dev host", () => {
    expect(resolveSchoolSubdomain("greenwood.localhost")).toBe("greenwood");
  });

  it("lowercases the resolved label", () => {
    expect(resolveSchoolSubdomain("GreenWood.kdlms.com")).toBe("greenwood");
  });

  it("returns null for the bare platform apex", () => {
    expect(resolveSchoolSubdomain("kdlms.com")).toBeNull();
  });

  it("returns null for plain localhost", () => {
    expect(resolveSchoolSubdomain("localhost")).toBeNull();
  });

  it("returns null for an IPv4 literal", () => {
    expect(resolveSchoolSubdomain("192.168.1.1")).toBeNull();
  });

  it("returns null for a bracketed IPv6 literal", () => {
    expect(resolveSchoolSubdomain("[::1]")).toBeNull();
  });

  it("returns null for the app/www/api platform hosts", () => {
    expect(resolveSchoolSubdomain("app.kdlms.com")).toBeNull();
    expect(resolveSchoolSubdomain("www.kdlms.com")).toBeNull();
    expect(resolveSchoolSubdomain("api.kdlms.com")).toBeNull();
  });

  it("falls back to VITE_DEV_SUBDOMAIN when the hostname yields nothing", () => {
    vi.stubEnv("VITE_DEV_SUBDOMAIN", "greenwood");
    expect(resolveSchoolSubdomain("localhost")).toBe("greenwood");
  });

  it("ignores a blank VITE_DEV_SUBDOMAIN", () => {
    vi.stubEnv("VITE_DEV_SUBDOMAIN", "  ");
    expect(resolveSchoolSubdomain("localhost")).toBeNull();
  });
});

describe("platformLoginUrl", () => {
  it("swaps a school subdomain for app on a production host", () => {
    const location = { hostname: "greenwood.kdlms.com", protocol: "https:", port: "" } as Location;
    expect(platformLoginUrl(location)).toBe("https://app.kdlms.com/login");
  });

  it("drops back to bare localhost for a *.localhost dev host", () => {
    const location = { hostname: "greenwood.localhost", protocol: "http:", port: "5173" } as Location;
    expect(platformLoginUrl(location)).toBe("http://localhost:5173/login");
  });

  it("leaves an already-unbranded host unchanged", () => {
    const location = { hostname: "localhost", protocol: "http:", port: "5173" } as Location;
    expect(platformLoginUrl(location)).toBe("http://localhost:5173/login");
  });
});

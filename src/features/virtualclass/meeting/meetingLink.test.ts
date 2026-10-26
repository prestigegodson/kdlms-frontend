import { describe, expect, it } from "vitest";
import { meetingLabel, meetingLinkError, meetingProviderOf } from "./meetingLink";

describe("meetingProviderOf", () => {
  it.each([
    ["https://meet.google.com/abc-defg-hij", "GOOGLE_MEET"],
    ["  https://zoom.us/j/123  ", "ZOOM"],
    ["https://us02web.zoom.us/j/123?pwd=abc", "ZOOM"],
    ["https://zoom.us:443/j/1", "ZOOM"],
  ])("accepts %s", (url, provider) => {
    expect(meetingProviderOf(url)).toBe(provider);
  });

  it.each([
    "http://zoom.us/j/1",
    "https://evilzoom.us/j/1",
    "https://zoom.us.evil.com/j/1",
    "https://meet.google.com.evil.com/x",
    "https://teams.microsoft.com/l/x",
    "https://user@zoom.us/j/1",
    "https://zoom.us:8443/j/1",
    "javascript:alert(1)",
    "zoom.us/j/1",
    "https://zoom.us/j/1 x",
    "",
  ])("refuses %s", (url) => {
    expect(meetingProviderOf(url)).toBeNull();
  });
});

describe("meetingLinkError", () => {
  it("asks for a link when blank and explains a wrong one", () => {
    expect(meetingLinkError(" ")).toBe("Add a Google Meet or Zoom meeting link.");
    expect(meetingLinkError("https://example.com")).toMatch(/Google Meet or Zoom/);
    expect(meetingLinkError("https://zoom.us/j/1")).toBeNull();
  });
});

describe("meetingLabel", () => {
  it("names the platform room or the provider", () => {
    expect(meetingLabel("PLATFORM", null)).toBe("Platform Video Conferencing");
    expect(meetingLabel("EXTERNAL", "ZOOM")).toBe("Zoom");
    expect(meetingLabel("EXTERNAL", "GOOGLE_MEET")).toBe("Google Meet");
  });
});

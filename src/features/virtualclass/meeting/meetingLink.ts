import type { MeetingMode, MeetingProvider } from "@/api/virtualClasses";

/**
 * Client-side twin of backend virtualclass.domain.MeetingLink: an https Google Meet
 * (`meet.google.com`) or Zoom (`zoom.us` / `*.zoom.us`) link, nothing else. The server re-checks
 * and is the authority; this only lets the form flag a bad link before saving.
 */
export const MAX_MEETING_URL_LENGTH = 2048;

export const PLATFORM_VIDEO_LABEL = "Platform Video Conferencing";

export function meetingProviderOf(raw: string): MeetingProvider | null {
  const value = raw.trim();
  if (value === "" || value.length > MAX_MEETING_URL_LENGTH || /\s/.test(value)) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username !== "" || url.password !== "") return null;
  if (url.port !== "" && url.port !== "443") return null;
  const host = url.hostname.toLowerCase();
  if (host === "meet.google.com") return "GOOGLE_MEET";
  if (host === "zoom.us" || host.endsWith(".zoom.us")) return "ZOOM";
  return null;
}

/** The message to show under the link field, or `null` when the link is fine. */
export function meetingLinkError(raw: string): string | null {
  if (raw.trim() === "") return "Add a Google Meet or Zoom meeting link.";
  return meetingProviderOf(raw) ? null : "Enter a Google Meet or Zoom meeting link (starting with https://).";
}

export function providerLabel(provider: MeetingProvider | null): string {
  switch (provider) {
    case "GOOGLE_MEET":
      return "Google Meet";
    case "ZOOM":
      return "Zoom";
    default:
      return "external meeting";
  }
}

/** A short "where is this held" label for lists and badges. */
export function meetingLabel(mode: MeetingMode, provider: MeetingProvider | null): string {
  return mode === "PLATFORM" ? PLATFORM_VIDEO_LABEL : providerLabel(provider);
}

/**
 * The one-line note a session row shows about its meeting: a warning while it has no meeting to
 * join, the provider for an external link, nothing for the built-in room (the default).
 */
export function meetingNote(
  mode: MeetingMode,
  provider: MeetingProvider | null,
  missing: boolean,
): { text: string; warning: boolean } | null {
  if (missing) return { text: "Meeting link not yet provided", warning: true };
  if (mode === "EXTERNAL") return { text: `On ${providerLabel(provider)}`, warning: false };
  return null;
}

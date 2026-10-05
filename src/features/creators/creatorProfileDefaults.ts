import type { CreatorProfileInput } from "@/api/creators";

/** The browser's own IANA timezone, falling back to Lagos when the runtime can't report one. */
export function defaultTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Africa/Lagos";
  } catch {
    return "Africa/Lagos";
  }
}

export function emptyCreatorProfile(): CreatorProfileInput {
  return {
    firstName: "",
    lastName: "",
    businessName: "",
    contactAddress: "",
    mobile: "",
    timezone: defaultTimezone(),
    currency: "NGN",
  };
}

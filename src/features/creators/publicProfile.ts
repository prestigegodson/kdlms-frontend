import type { PublicContactLink } from "@/api/creators";
import { platformUrl } from "@/utils/host";

/** The shareable address of a tutor's public page - always on the platform's own host. */
export function publicProfileUrl(handle: string): string {
  return platformUrl(`/tutors/${handle}`);
}

/** Where a contact link goes - `mailto:`/`tel:`/WhatsApp's click-to-chat, or the URL itself. */
export function contactHref(link: PublicContactLink): string {
  switch (link.platform) {
    case "EMAIL":
      return `mailto:${link.value}`;
    case "PHONE":
      return `tel:${link.value.replace(/[^\d+]/g, "")}`;
    case "WHATSAPP":
      return `https://wa.me/${link.value.replace(/\D/g, "")}`;
    default:
      return link.value;
  }
}

/** "Ada Lovelace Byron" -> first "Ada", last "Lovelace Byron"; a single word fills the first name only. */
export function splitName(name: string): { firstName: string; lastName: string } {
  const parts = name.trim().split(/\s+/);
  return { firstName: parts[0] ?? "", lastName: parts.slice(1).join(" ") };
}

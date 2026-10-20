import type { ComponentProps } from "react";
import type { NewsletterAudience, NewsletterStatus } from "@/api/newsletters";
import type { Badge } from "@/components/ui/Badge";

type BadgeVariant = NonNullable<ComponentProps<typeof Badge>["variant"]>;

export const NEWSLETTER_STATUS_LABEL: Record<NewsletterStatus, string> = {
  DRAFT: "Draft",
  SCHEDULED: "Scheduled",
  SENDING: "Sending",
  SENT: "Sent",
  CANCELLED: "Cancelled",
};

/** Green/red only for real outcomes (style_guide.md) - a draft or a cancelled send is neutral. */
export const NEWSLETTER_STATUS_VARIANT: Record<NewsletterStatus, BadgeVariant> = {
  DRAFT: "neutral",
  SCHEDULED: "info",
  SENDING: "warning",
  SENT: "success",
  CANCELLED: "neutral",
};

/** The merge tags the backend fills per recipient - see backend newsletter.domain.MergeTags. */
export const MERGE_TAGS: Array<{ tag: string; label: string; sample: string }> = [
  { tag: "{{name}}", label: "Name", sample: "Ada Obi" },
  { tag: "{{school_name}}", label: "School name", sample: "Greenwood Academy" },
  { tag: "{{email}}", label: "Email", sample: "ada@example.com" },
  { tag: "{{unsubscribe_url}}", label: "Unsubscribe link", sample: "#unsubscribe" },
];

const UNSUBSCRIBE_TAG = "{{unsubscribe_url}}";

/**
 * The HTML exactly as the preview pane shows it: merge tags filled with sample values, and - as
 * the backend's NewsletterHtml.forSending does - the compliance footer appended when the body has
 * no unsubscribe link of its own, so the admin sees what recipients will get. (The hidden
 * preheader is shown beside the subject in the preview's inbox line instead.)
 */
export function previewHtml(html: string): string {
  let result = html;
  if (!html.includes(UNSUBSCRIBE_TAG)) {
    const footer =
      '<div style="margin:24px auto 0;max-width:600px;padding:16px;text-align:center;' +
      'font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:#64748b">' +
      "You're receiving this email because you use KDLMS. " +
      `<a href="${UNSUBSCRIBE_TAG}" style="color:#64748b;text-decoration:underline">Unsubscribe</a></div>`;
    result = /<\/body>/i.test(result)
      ? result.replace(/<\/body>/i, `${footer}</body>`)
      : result + footer;
  }
  for (const { tag, sample } of MERGE_TAGS) {
    result = result.split(tag).join(sample);
  }
  return result;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMBEDDED_EMAIL = /[^\s,;"'<>()[\]]+@[^\s,;"'<>()[\]]+\.[^\s,;"'<>()[\]]+/g;

/** Splits pasted text (commas, semicolons, spaces or new lines) into lower-cased, de-duplicated addresses. */
export function parseEmailList(text: string): { valid: string[]; invalid: string[] } {
  const valid = new Set<string>();
  const invalid = new Set<string>();
  for (const raw of text.split(/[\s,;]+/)) {
    const email = raw.trim().toLowerCase();
    if (!email) continue;
    if (EMAIL_PATTERN.test(email)) valid.add(email);
    else invalid.add(raw.trim());
  }
  return { valid: [...valid], invalid: [...invalid] };
}

/** Every address-shaped token in an uploaded CSV/text file, whatever its column layout. */
export function extractEmails(text: string): string[] {
  return [...new Set((text.match(EMBEDDED_EMAIL) ?? []).map((email) => email.toLowerCase()))];
}

/** One line describing an audience, for the list page. */
export function describeAudience(audience: NewsletterAudience): string {
  const parts: string[] = [];
  if (audience.schoolAdmins) {
    const narrowed =
      audience.schoolStatuses.length > 0 ||
      audience.packageIds.length > 0 ||
      audience.schoolIds.length > 0;
    parts.push(narrowed ? "School admins (filtered)" : "All school admins");
  }
  if (audience.creators) parts.push("Creators");
  if (audience.customEmails.length > 0) {
    parts.push(
      `${audience.customEmails.length} custom ${audience.customEmails.length === 1 ? "email" : "emails"}`,
    );
  }
  return parts.length > 0 ? parts.join(" · ") : "No audience yet";
}

export const DEFAULT_AUDIENCE: NewsletterAudience = {
  schoolAdmins: true,
  schoolStatuses: ["ACTIVE"],
  packageIds: [],
  schoolIds: [],
  creators: false,
  customEmails: [],
};

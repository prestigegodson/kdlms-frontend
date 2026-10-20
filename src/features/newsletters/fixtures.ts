import type { AudiencePreview, NewsletterView } from "@/api/newsletters";

export function newsletter(overrides: Partial<NewsletterView> = {}): NewsletterView {
  return {
    id: "n1",
    subject: "October news",
    preheader: "What's new",
    htmlBody: "<html><body><p>Hello {{name}}</p></body></html>",
    audience: {
      schoolAdmins: true,
      schoolStatuses: ["ACTIVE"],
      packageIds: [],
      schoolIds: [],
      creators: false,
      customEmails: [],
    },
    status: "DRAFT",
    scheduledAt: null,
    startedAt: null,
    completedAt: null,
    recipientCount: 0,
    sentCount: 0,
    failedCount: 0,
    suppressedCount: 0,
    createdAt: "2026-10-01T09:00:00Z",
    updatedAt: "2026-10-01T09:00:00Z",
    ...overrides,
  };
}

export function audiencePreview(overrides: Partial<AudiencePreview> = {}): AudiencePreview {
  return {
    schoolAdmins: 42,
    creators: 0,
    customEmails: 0,
    duplicates: 0,
    suppressed: 2,
    total: 40,
    sample: [],
    ...overrides,
  };
}

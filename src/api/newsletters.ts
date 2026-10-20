import { apiFetch } from "@/api/client";
import type { Page } from "@/api/types";

/** Mirrors backend newsletter.domain.NewsletterStatus. */
export type NewsletterStatus = "DRAFT" | "SCHEDULED" | "SENDING" | "SENT" | "CANCELLED";

/** Mirrors backend shared.domain.TenantStatus, minus UNKNOWN (not a filter value). */
export type SchoolStatusFilter = "ACTIVE" | "SUSPENDED" | "ARCHIVED";

/**
 * Who a newsletter goes to. Mirrors backend ManageNewslettersUseCase.AudienceView /
 * AdminNewslettersController.AudienceRequest. An empty filter list means "no narrowing" on that
 * dimension; filters combine with AND, and only apply to the school-admin segment.
 */
export interface NewsletterAudience {
  schoolAdmins: boolean;
  schoolStatuses: SchoolStatusFilter[];
  packageIds: string[];
  schoolIds: string[];
  creators: boolean;
  customEmails: string[];
}

/** Mirrors backend ManageNewslettersUseCase.NewsletterView. */
export interface NewsletterView {
  id: string;
  subject: string;
  preheader: string | null;
  htmlBody: string;
  audience: NewsletterAudience;
  status: NewsletterStatus;
  scheduledAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  suppressedCount: number;
  createdAt: string;
  updatedAt: string;
}

/** The list row - everything but the HTML body. */
export type NewsletterSummaryView = Omit<NewsletterView, "htmlBody" | "preheader">;

export interface SaveNewsletterRequest {
  subject: string;
  preheader: string;
  htmlBody: string;
  audience: NewsletterAudience;
}

export interface SampleRecipient {
  email: string;
  name: string | null;
  schoolName: string | null;
}

/** Per-segment counts before de-duplication; `total` is who would actually be emailed. */
export interface AudiencePreview {
  schoolAdmins: number;
  creators: number;
  customEmails: number;
  duplicates: number;
  suppressed: number;
  total: number;
  sample: SampleRecipient[];
}

export type SuppressionReason = "UNSUBSCRIBED" | "MANUAL";

export interface SuppressionView {
  email: string;
  reason: SuppressionReason;
  sourceNewsletterId: string | null;
  createdAt: string;
}

export interface UnsubscribeStatus {
  maskedEmail: string;
  unsubscribed: boolean;
}

/** Mirrors backend ManageNewslettersUseCase.MAX_TEST_RECIPIENTS. */
export const MAX_TEST_RECIPIENTS = 5;
/** Mirrors backend NewsletterHtml.MAX_LENGTH. */
export const MAX_HTML_LENGTH = 500_000;
/** Mirrors backend NewsletterAudience.MAX_CUSTOM_EMAILS. */
export const MAX_CUSTOM_EMAILS = 5_000;

const BASE = "/api/v1/admin/newsletters";
const SUPPRESSIONS = "/api/v1/admin/newsletter-suppressions";

export function listNewsletters(
  status: NewsletterStatus | "",
  page = 0,
  size = 20,
): Promise<Page<NewsletterSummaryView>> {
  const statusParam = status ? `&status=${status}` : "";
  return apiFetch<Page<NewsletterSummaryView>>(`${BASE}?page=${page}&size=${size}${statusParam}`);
}

export function getNewsletter(id: string): Promise<NewsletterView> {
  return apiFetch<NewsletterView>(`${BASE}/${id}`);
}

export function createNewsletter(request: SaveNewsletterRequest): Promise<NewsletterView> {
  return apiFetch<NewsletterView>(BASE, { method: "POST", body: JSON.stringify(request) });
}

export function updateNewsletter(
  id: string,
  request: SaveNewsletterRequest,
): Promise<NewsletterView> {
  return apiFetch<NewsletterView>(`${BASE}/${id}`, {
    method: "PUT",
    body: JSON.stringify(request),
  });
}

export function deleteNewsletter(id: string): Promise<void> {
  return apiFetch<void>(`${BASE}/${id}`, { method: "DELETE" });
}

export function duplicateNewsletter(id: string): Promise<NewsletterView> {
  return apiFetch<NewsletterView>(`${BASE}/${id}/duplicate`, { method: "POST" });
}

export function previewAudience(audience: NewsletterAudience): Promise<AudiencePreview> {
  return apiFetch<AudiencePreview>(`${BASE}/audience-preview`, {
    method: "POST",
    body: JSON.stringify(audience),
  });
}

/** An empty `emails` list sends the test to the caller's own address. */
export function sendTestNewsletter(id: string, emails: string[]): Promise<void> {
  return apiFetch<void>(`${BASE}/${id}/test`, { method: "POST", body: JSON.stringify({ emails }) });
}

export function sendNewsletterNow(id: string): Promise<NewsletterView> {
  return apiFetch<NewsletterView>(`${BASE}/${id}/send`, { method: "POST" });
}

/** `scheduledAt` is an ISO instant. */
export function scheduleNewsletter(id: string, scheduledAt: string): Promise<NewsletterView> {
  return apiFetch<NewsletterView>(`${BASE}/${id}/schedule`, {
    method: "POST",
    body: JSON.stringify({ scheduledAt }),
  });
}

export function unscheduleNewsletter(id: string): Promise<NewsletterView> {
  return apiFetch<NewsletterView>(`${BASE}/${id}/unschedule`, { method: "POST" });
}

export function cancelNewsletter(id: string): Promise<NewsletterView> {
  return apiFetch<NewsletterView>(`${BASE}/${id}/cancel`, { method: "POST" });
}

export function listSuppressions(
  query: string,
  page = 0,
  size = 20,
): Promise<Page<SuppressionView>> {
  return apiFetch<Page<SuppressionView>>(
    `${SUPPRESSIONS}?page=${page}&size=${size}&q=${encodeURIComponent(query)}`,
  );
}

export function addSuppression(email: string): Promise<SuppressionView> {
  return apiFetch<SuppressionView>(SUPPRESSIONS, {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export function removeSuppression(email: string): Promise<void> {
  return apiFetch<void>(`${SUPPRESSIONS}?email=${encodeURIComponent(email)}`, { method: "DELETE" });
}

/** Public - the landing page behind every newsletter's unsubscribe link. */
export function getUnsubscribeStatus(token: string): Promise<UnsubscribeStatus> {
  return apiFetch<UnsubscribeStatus>(
    `/api/v1/public/newsletter/unsubscribe?token=${encodeURIComponent(token)}`,
    { authenticated: false },
  );
}

export function confirmUnsubscribe(token: string): Promise<UnsubscribeStatus> {
  return apiFetch<UnsubscribeStatus>("/api/v1/public/newsletter/unsubscribe", {
    method: "POST",
    authenticated: false,
    body: JSON.stringify({ token }),
  });
}

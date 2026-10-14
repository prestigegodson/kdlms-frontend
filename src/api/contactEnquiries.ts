import { apiFetch } from "@/api/client";
import type { Page } from "@/api/types";

/** The system admin's inbox of public "contact us" enquiries. */

export type ContactEnquiryStatus = "NEW" | "READ" | "RESOLVED";

/** Mirrors backend platform.application.port.in.ManageContactEnquiriesUseCase.ContactEnquiryView. */
export interface ContactEnquiryView {
  id: string;
  schoolName: string;
  address: string | null;
  contactEmail: string | null;
  contactPhone: string;
  contactPersonName: string | null;
  message: string | null;
  status: ContactEnquiryStatus;
  createdAt: string;
  updatedAt: string;
}

const BASE = "/api/v1/admin/contact-enquiries";

export function listContactEnquiries(
  query: string,
  status: ContactEnquiryStatus | "",
  page = 0,
  size = 20,
): Promise<Page<ContactEnquiryView>> {
  const params = new URLSearchParams({ page: String(page), size: String(size) });
  if (query.trim()) params.set("q", query.trim());
  if (status) params.set("status", status);
  return apiFetch<Page<ContactEnquiryView>>(`${BASE}?${params}`);
}

export function getContactEnquiry(id: string): Promise<ContactEnquiryView> {
  return apiFetch<ContactEnquiryView>(`${BASE}/${id}`);
}

export function setContactEnquiryStatus(
  id: string,
  status: ContactEnquiryStatus,
): Promise<ContactEnquiryView> {
  return apiFetch<ContactEnquiryView>(`${BASE}/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export function deleteContactEnquiry(id: string): Promise<void> {
  return apiFetch<void>(`${BASE}/${id}`, { method: "DELETE" });
}

/** Enquiries nobody has opened yet - the nav badge. */
export function getUnreadContactEnquiryCount(): Promise<{ count: number }> {
  return apiFetch<{ count: number }>(`${BASE}/unread-count`);
}

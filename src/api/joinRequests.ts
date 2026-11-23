import { apiFetch } from "@/api/client";
import type { Page } from "@/api/types";

/** Mirrors backend creator.domain.JoinRequestStatus. */
export type JoinRequestStatus = "PENDING" | "ADDED" | "DISMISSED";

/** Mirrors backend creator.application.port.in.ManageJoinRequestsUseCase.JoinRequestView. */
export interface JoinRequest {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  message: string | null;
  status: JoinRequestStatus;
  createdAt: string;
  /** Bumped when the same person asks again while the request is still pending. */
  updatedAt: string;
  handledAt: string | null;
}

const BASE = "/api/v1/creator/join-requests";

/** The tutor's inbox, most recent first; no `status` lists every status. */
export function listJoinRequests(
  status: JoinRequestStatus | null,
  page = 0,
  size = 20,
): Promise<Page<JoinRequest>> {
  const params = new URLSearchParams({ page: String(page), size: String(size) });
  if (status) {
    params.set("status", status);
  }
  return apiFetch<Page<JoinRequest>>(`${BASE}?${params.toString()}`);
}

export function getPendingJoinRequestCount(): Promise<{ count: number }> {
  return apiFetch<{ count: number }>(`${BASE}/pending-count`);
}

/** Records that the tutor added this person as a learner. */
export function markJoinRequestAdded(id: string): Promise<JoinRequest> {
  return apiFetch<JoinRequest>(`${BASE}/${id}/added`, { method: "POST" });
}

export function dismissJoinRequest(id: string): Promise<JoinRequest> {
  return apiFetch<JoinRequest>(`${BASE}/${id}/dismiss`, { method: "POST" });
}

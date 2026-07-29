import { apiFetch } from "@/api/client";
import type { Page } from "@/api/types";

export type BranchStatus = "ACTIVE" | "INACTIVE";

/** Mirrors backend school.application.port.in.BranchView. */
export interface BranchView {
  id: string;
  schoolId: string;
  name: string;
  address?: string;
  phone?: string;
  main: boolean;
  status: BranchStatus;
}

export interface CreateBranchRequest {
  name: string;
  address?: string;
  phone?: string;
}

export type UpdateBranchRequest = CreateBranchRequest;

const BASE = "/api/v1/branches";

export function listBranches(page = 0, size = 50): Promise<Page<BranchView>> {
  return apiFetch<Page<BranchView>>(`${BASE}?page=${page}&size=${size}`);
}

export function createBranch(request: CreateBranchRequest): Promise<BranchView> {
  return apiFetch<BranchView>(BASE, { method: "POST", body: JSON.stringify(request) });
}

export function updateBranch(branchId: string, request: UpdateBranchRequest): Promise<BranchView> {
  return apiFetch<BranchView>(`${BASE}/${branchId}`, {
    method: "PUT",
    body: JSON.stringify(request),
  });
}

export function deactivateBranch(branchId: string): Promise<void> {
  return apiFetch<void>(`${BASE}/${branchId}/deactivate`, { method: "PATCH" });
}

export function activateBranch(branchId: string): Promise<void> {
  return apiFetch<void>(`${BASE}/${branchId}/activate`, { method: "PATCH" });
}

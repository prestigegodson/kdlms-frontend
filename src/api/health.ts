import { apiFetch } from "@/api/client";

export interface HealthResponse {
  status: string;
  application: string;
  version: string;
  timestamp: string;
}

export function getHealth(): Promise<HealthResponse> {
  return apiFetch<HealthResponse>("/api/v1/health", { authenticated: false });
}

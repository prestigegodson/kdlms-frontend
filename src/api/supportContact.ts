import { apiFetch } from "@/api/client";

/** Mirrors backend platform.application.port.in.ManageSupportContactUseCase.SupportContactView. */
export interface SupportContactView {
  supportEmail: string | null;
  supportPhone: string | null;
  whatsappNumber: string | null;
}

/** A full replace, like the rest of this resource - omitting a field clears it. */
export interface SaveSupportContactRequest {
  supportEmail: string | null;
  supportPhone: string | null;
  whatsappNumber: string | null;
}

const SCHOOL_BASE = "/api/v1/support-contact";
const ADMIN_BASE = "/api/v1/admin/support-contact";

/** SCHOOL_ADMIN/BRANCH_ADMIN read - GET /api/v1/support-contact. */
export function getSupportContact(): Promise<SupportContactView> {
  return apiFetch<SupportContactView>(SCHOOL_BASE);
}

/** SYSTEM_ADMIN read - GET /api/v1/admin/support-contact. */
export function getAdminSupportContact(): Promise<SupportContactView> {
  return apiFetch<SupportContactView>(ADMIN_BASE);
}

/** SYSTEM_ADMIN write - PUT /api/v1/admin/support-contact. */
export function updateSupportContact(request: SaveSupportContactRequest): Promise<SupportContactView> {
  return apiFetch<SupportContactView>(ADMIN_BASE, { method: "PUT", body: JSON.stringify(request) });
}

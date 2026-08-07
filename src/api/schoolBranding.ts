import { apiFetch } from "@/api/client";

/**
 * Mirrors backend reporting.application.port.in.ViewMySchoolBrandingUseCase.SchoolBrandingView -
 * the caller's own school's brand mark for the app chrome, readable by every
 * school-scoped role including GUARDIAN (unlike `api/reportSettings.ts`'s
 * `getReportSettings`, which is SCHOOL_ADMIN/BRANCH_ADMIN only and returns a
 * bare fileId) so PortalShell's sidebar can swap the platform wordmark for
 * the school's logo. `logoDataUri` is already an inlined `data:` URI - never
 * a bare `<img src="/api/v1/files/...">`, since the files bucket is private
 * and GUARDIAN has no read access to it at all.
 */
export interface MySchoolBrandingView {
  schoolName?: string;
  logoDataUri?: string;
}

export function getMySchoolBranding(): Promise<MySchoolBrandingView> {
  return apiFetch<MySchoolBrandingView>("/api/v1/me/school-branding");
}

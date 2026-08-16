import { ApiError, apiFetch } from "@/api/client";
import type { MySchoolBrandingView } from "@/api/schoolBranding";

/**
 * The anonymous, subdomain-keyed counterpart to `getMySchoolBranding` - for
 * a school's branded login page, where nobody is authenticated yet. Mirrors
 * backend `reporting.adapter.in.web.PublicSchoolBrandingController`, which
 * reuses the exact same `SchoolBrandingView` shape `getMySchoolBranding`
 * returns. `authenticated: false` also skips `client.ts`'s 401-refresh
 * branch, which an anonymous call has no use for.
 *
 * Returns `null` for a subdomain the backend doesn't recognize (404) -
 * every other error still propagates, so a genuine network/server failure
 * doesn't get silently swallowed into "no branding".
 */
export async function getPublicSchoolBranding(subdomain: string): Promise<MySchoolBrandingView | null> {
  try {
    return await apiFetch<MySchoolBrandingView>(
      `/api/v1/public/school-branding?subdomain=${encodeURIComponent(subdomain)}`,
      { authenticated: false },
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

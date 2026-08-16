import { useEffect } from "react";
import { usePublicBrandingStore } from "@/stores/publicBrandingStore";

const DEFAULT_TITLE = "KDLMS — School Management";

/**
 * Mounted once from `layouts/RootLayout.tsx` - the one app-wide mount
 * point, since there is no `App.tsx`. On the platform's own host this is a
 * no-op: `usePublicBrandingStore.fetchIfNeeded` settles into `"not-found"`
 * with no network call, so `document.title` stays whatever `index.html`
 * set it to. On a school's branded subdomain (Phase 13), the tab title
 * carries the school's own name once branding loads - shared by every
 * route, not just the auth screens, since `PortalShell`'s authenticated
 * shell has no `document.title` handling of its own either.
 */
export function useDocumentTitle(): void {
  const fetchIfNeeded = usePublicBrandingStore((state) => state.fetchIfNeeded);
  const schoolName = usePublicBrandingStore((state) => state.schoolName);

  useEffect(() => {
    fetchIfNeeded();
  }, [fetchIfNeeded]);

  useEffect(() => {
    document.title = schoolName ? `${schoolName} — School Management` : DEFAULT_TITLE;
  }, [schoolName]);
}

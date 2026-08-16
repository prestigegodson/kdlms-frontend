import { create } from "zustand";
import { getPublicSchoolBranding } from "@/api/publicBranding";
import { resolveSchoolSubdomain } from "@/utils/host";

type FetchStatus = "idle" | "loading" | "loaded" | "not-found" | "error";

interface PublicBrandingState {
  /** The subdomain this state was fetched for - lets a caller tell "not fetched yet" apart from "no branding for this host". */
  subdomain: string | null;
  schoolName?: string;
  logoDataUri?: string;
  status: FetchStatus;
  /** Fetches once per resolved host; a repeat call while loaded/loading is a no-op. */
  fetchIfNeeded: () => Promise<void>;
}

/**
 * Caches the *anonymous* branding for whatever school subdomain the current
 * page is loaded on (`utils/host.ts`'s `resolveSchoolSubdomain`), for the
 * auth screens (`features/auth/AuthLayout.tsx`) and the document title
 * (`hooks/useDocumentTitle.ts`). Deliberately separate from
 * `schoolBrandingStore`, which is authenticated and keyed by the logged-in
 * user's own school - this one is host-derived and auth-independent, so it
 * is NOT reset by `authStore.logout()`: the host doesn't change just
 * because a session ended.
 *
 * On the platform's own host (`resolveSchoolSubdomain` returns `null`)
 * this settles into `status: "not-found"` immediately, with no network
 * call - every consumer's fallback (the KDLMS wordmark, the default tab
 * title) is exactly what today's unbranded behaviour already does.
 */
export const usePublicBrandingStore = create<PublicBrandingState>((set, get) => ({
  subdomain: null,
  schoolName: undefined,
  logoDataUri: undefined,
  status: "idle",

  fetchIfNeeded: async () => {
    if (get().status === "loading" || get().status === "loaded") {
      return;
    }
    const subdomain = resolveSchoolSubdomain();
    if (!subdomain) {
      set({ subdomain: null, status: "not-found" });
      return;
    }
    set({ subdomain, status: "loading" });
    try {
      const branding = await getPublicSchoolBranding(subdomain);
      if (!branding) {
        set({ status: "not-found" });
        return;
      }
      set({ schoolName: branding.schoolName, logoDataUri: branding.logoDataUri, status: "loaded" });
    } catch {
      set({ status: "error" });
    }
  },
}));

/** Test helper: resets the store to its initial (unfetched) state - mirrors stores/schoolBrandingStore.ts's resetSchoolBrandingStore(). */
export function resetPublicBrandingStore(): void {
  usePublicBrandingStore.setState({ subdomain: null, schoolName: undefined, logoDataUri: undefined, status: "idle" });
}

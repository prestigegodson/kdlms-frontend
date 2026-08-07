import { create } from "zustand";
import { getMySchoolBranding } from "@/api/schoolBranding";

type FetchStatus = "idle" | "loading" | "loaded" | "error";

interface SchoolBrandingState {
  schoolName?: string;
  logoDataUri?: string;
  status: FetchStatus;
  /** Fetches once per session; a repeat call while loaded/loading is a no-op. */
  fetchIfNeeded: () => Promise<void>;
  reset: () => void;
}

/**
 * Caches the caller's own school's brand mark (GET /api/v1/me/school-branding)
 * for PortalShell's sidebar - a school with no logo set (or still
 * loading/errored) leaves `logoDataUri` undefined, and the sidebar falls
 * back to the platform wordmark. Mirrors stores/featureStore.ts's shape.
 * Both SchoolLayout and GuardianLayout trigger the fetch on mount;
 * authStore's logout() calls reset() so a later, different school's
 * session in the same tab never inherits a stale logo.
 */
export const useSchoolBrandingStore = create<SchoolBrandingState>((set, get) => ({
  schoolName: undefined,
  logoDataUri: undefined,
  status: "idle",

  fetchIfNeeded: async () => {
    if (get().status === "loading" || get().status === "loaded") {
      return;
    }
    set({ status: "loading" });
    try {
      const branding = await getMySchoolBranding();
      set({ schoolName: branding.schoolName, logoDataUri: branding.logoDataUri, status: "loaded" });
    } catch {
      set({ schoolName: undefined, logoDataUri: undefined, status: "error" });
    }
  },

  reset: () => set({ schoolName: undefined, logoDataUri: undefined, status: "idle" }),
}));

/** Test helper: resets the store to its initial (unfetched) state - mirrors stores/featureStore.ts's resetFeatureStore(). */
export function resetSchoolBrandingStore(): void {
  useSchoolBrandingStore.setState({ schoolName: undefined, logoDataUri: undefined, status: "idle" });
}

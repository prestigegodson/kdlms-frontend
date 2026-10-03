import { create } from "zustand";
import {
  getMyOnboarding,
  resetAllTours,
  saveTourProgress,
  type TourProgressView,
  type TourStatus,
  updateOnboardingPreferences,
} from "@/api/onboarding";
import { useAuthStore } from "@/stores/authStore";

type FetchStatus = "idle" | "loading" | "loaded" | "error";

export interface ActiveTour {
  key: string;
  /** Where to start - a resumed guide picks up at its saved step. */
  startIndex: number;
  /** Started from the help menu or How-to guides page rather than automatically. */
  manual: boolean;
}

interface OnboardingState {
  status: FetchStatus;
  autoStart: boolean;
  progress: Record<string, TourProgressView>;
  active: ActiveTour | null;
  /** The hrefs of every nav item PortalShell is currently showing - guides for hidden pages aren't offered. */
  visibleNavHrefs: ReadonlySet<string>;
  fetchIfNeeded: () => Promise<void>;
  start: (key: string, options?: { manual?: boolean; startIndex?: number }) => void;
  stop: () => void;
  /** Optimistically records progress, then saves it. A failed save is logged, never surfaced. */
  record: (key: string, version: number, status: TourStatus, stepIndex: number) => void;
  setAutoStart: (autoStart: boolean) => Promise<void>;
  resetAll: () => Promise<void>;
  setVisibleNavHrefs: (hrefs: string[]) => void;
  reset: () => void;
}

const INITIAL = {
  status: "idle" as FetchStatus,
  autoStart: true,
  progress: {} as Record<string, TourProgressView>,
  active: null as ActiveTour | null,
  visibleNavHrefs: new Set<string>() as ReadonlySet<string>,
};

/** During impersonation nothing is saved - the backend refuses it anyway (403). */
function impersonating(): boolean {
  return useAuthStore.getState().impersonation !== null;
}

/**
 * The calling user's onboarding-guide progress (GET /api/v1/me/onboarding) plus which guide is
 * running right now. Fetched once per session by PortalShell; authStore's
 * resetSessionScopedStores() calls reset() on logout and impersonation start/stop.
 */
export const useOnboardingStore = create<OnboardingState>((set, get) => ({
  ...INITIAL,

  fetchIfNeeded: async () => {
    if (get().status === "loading" || get().status === "loaded") {
      return;
    }
    set({ status: "loading" });
    try {
      const view = await getMyOnboarding();
      set({
        status: "loaded",
        autoStart: view.autoStart,
        progress: Object.fromEntries(view.tours.map((tour) => [tour.key, tour])),
      });
    } catch {
      // Guides are a nicety - with no progress to go on, never auto-start anything.
      set({ status: "error" });
    }
  },

  start: (key, options) =>
    set({ active: { key, startIndex: options?.startIndex ?? 0, manual: options?.manual ?? false } }),

  stop: () => set({ active: null }),

  record: (key, version, status, stepIndex) => {
    if (impersonating()) {
      return;
    }
    set((state) => ({
      progress: {
        ...state.progress,
        [key]: { key, version, status, stepIndex, updatedAt: new Date().toISOString() },
      },
    }));
    saveTourProgress(key, { version, status, stepIndex }).catch((error: unknown) => {
      console.warn("Couldn't save onboarding progress", error);
    });
  },

  setAutoStart: async (autoStart) => {
    if (impersonating()) {
      return;
    }
    const previous = get().autoStart;
    set({ autoStart });
    try {
      await updateOnboardingPreferences(autoStart);
    } catch (error) {
      set({ autoStart: previous });
      throw error;
    }
  },

  resetAll: async () => {
    if (impersonating()) {
      return;
    }
    await resetAllTours();
    set({ progress: {}, active: null });
  },

  setVisibleNavHrefs: (hrefs) => {
    const current = get().visibleNavHrefs;
    if (current.size === hrefs.length && hrefs.every((href) => current.has(href))) {
      return;
    }
    set({ visibleNavHrefs: new Set(hrefs) });
  },

  reset: () => set({ ...INITIAL, visibleNavHrefs: new Set<string>() }),
}));

/** Test helper: resets the store to its initial (unfetched) state. */
export function resetOnboardingStore(): void {
  useOnboardingStore.getState().reset();
}

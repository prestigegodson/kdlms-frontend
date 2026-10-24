import { create } from "zustand";
import { getMyFeatures } from "@/api/features";

type FetchStatus = "idle" | "loading" | "loaded" | "error";

interface FeatureState {
  communication: boolean;
  timetable: boolean;
  lessonNotes: boolean;
  aiLessonNotes: boolean;
  takeHomeQuiz: boolean;
  billing: boolean;
  onDemandLearning: boolean;
  learningMedia: boolean;
  studentLogins: boolean;
  onlineClasses: boolean;
  interactiveQuestions: boolean;
  interactiveVideo: boolean;
  status: FetchStatus;
  /** When the flags were last fetched successfully - null until the first success. */
  loadedAt: number | null;
  /** Fetches once per session; a repeat call while loaded/loading is a no-op. */
  fetchIfNeeded: () => Promise<void>;
  /**
   * Refetches in the background when the last fetch failed or the flags are older than
   * `maxAgeMs` - see hooks/useRevalidateOnResume.ts. The current flags stay visible meanwhile.
   */
  revalidate: (maxAgeMs: number) => Promise<void>;
  reset: () => void;
}

const UNFETCHED_FLAGS = {
  communication: false,
  timetable: false,
  lessonNotes: false,
  aiLessonNotes: false,
  takeHomeQuiz: false,
  billing: false,
  onDemandLearning: false,
  learningMedia: false,
  studentLogins: false,
  onlineClasses: false,
  interactiveQuestions: false,
  interactiveVideo: false,
} as const;

/**
 * Caches the calling user's own school's gated feature flags
 * (GET /api/v1/me/features), so the Messages/Timetable/Lesson notes/Take-home
 * quizzes/Billing nav items in both the school portal and the guardian portal
 * read the same fetch rather than each re-querying it. Mirrors
 * stores/teacherScopeStore.ts's shape. Both SchoolLayout and GuardianLayout
 * trigger the fetch on mount; authStore's logout() calls reset() so a later,
 * different session in the same tab never inherits a stale answer.
 *
 * A failed fetch keeps the last flags that loaded (all false only if none ever
 * did) and is retried by revalidate(), which the layouts call when the tab
 * regains focus - so a fetch that failed while the laptop was waking never
 * hides nav items until a manual reload.
 */
export const useFeatureStore = create<FeatureState>((set, get) => {
  // Bumped by reset(), so a fetch still in flight at logout can't repopulate the next session.
  let generation = 0;

  async function load(): Promise<void> {
    const started = generation;
    set({ status: "loading" });
    try {
      const features = await getMyFeatures();
      if (started !== generation) {
        return;
      }
      set({
        communication: features.communication,
        timetable: features.timetable,
        lessonNotes: features.lessonNotes,
        aiLessonNotes: features.aiLessonNotes,
        takeHomeQuiz: features.takeHomeQuiz,
        billing: features.billing,
        onDemandLearning: features.onDemandLearning,
        learningMedia: features.learningMedia,
        studentLogins: features.studentLogins,
        onlineClasses: features.onlineClasses ?? false,
        interactiveQuestions: features.interactiveQuestions ?? false,
        interactiveVideo: features.interactiveVideo ?? false,
        status: "loaded",
        loadedAt: Date.now(),
      });
    } catch {
      if (started === generation) {
        set({ status: "error" });
      }
    }
  }

  return {
    ...UNFETCHED_FLAGS,
    status: "idle",
    loadedAt: null,

    fetchIfNeeded: async () => {
      if (get().status === "loading" || get().status === "loaded") {
        return;
      }
      await load();
    },

    revalidate: async (maxAgeMs) => {
      const { status, loadedAt } = get();
      // idle = never asked for (or just reset) - fetchIfNeeded owns the first fetch.
      if (status === "idle" || status === "loading") {
        return;
      }
      if (status === "loaded" && (loadedAt === null || Date.now() - loadedAt < maxAgeMs)) {
        return;
      }
      await load();
    },

    reset: () => {
      generation++;
      set({ ...UNFETCHED_FLAGS, status: "idle", loadedAt: null });
    },
  };
});

/** Test helper: resets the store to its initial (unfetched) state - mirrors stores/teacherScopeStore.ts's resetTeacherScopeStore(). */
export function resetFeatureStore(): void {
  useFeatureStore.getState().reset();
}

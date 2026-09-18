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
  status: FetchStatus;
  /** Fetches once per session; a repeat call while loaded/loading is a no-op. */
  fetchIfNeeded: () => Promise<void>;
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
} as const;

/**
 * Caches the calling user's own school's gated feature flags
 * (GET /api/v1/me/features), so the Messages/Timetable/Lesson notes/Take-home
 * quizzes/Billing nav items in both the school portal and the guardian portal
 * read the same fetch rather than each re-querying it. Mirrors
 * stores/teacherScopeStore.ts's shape. Both SchoolLayout and GuardianLayout
 * trigger the fetch on mount; authStore's logout() calls reset() so a later,
 * different session in the same tab never inherits a stale answer.
 */
export const useFeatureStore = create<FeatureState>((set, get) => ({
  ...UNFETCHED_FLAGS,
  status: "idle",

  fetchIfNeeded: async () => {
    if (get().status === "loading" || get().status === "loaded") {
      return;
    }
    set({ status: "loading" });
    try {
      const features = await getMyFeatures();
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
        status: "loaded",
      });
    } catch {
      set({ ...UNFETCHED_FLAGS, status: "error" });
    }
  },

  reset: () => set({ ...UNFETCHED_FLAGS, status: "idle" }),
}));

/** Test helper: resets the store to its initial (unfetched) state - mirrors stores/teacherScopeStore.ts's resetTeacherScopeStore(). */
export function resetFeatureStore(): void {
  useFeatureStore.setState({ ...UNFETCHED_FLAGS, status: "idle" });
}

import { ApiError } from "@/api/client";

/**
 * Loads one per-class list for every class a learner belongs to - the "All classes" view of the
 * learner's Resources, Quizzes and Lesson notes pages. A class whose tutor's package doesn't include
 * the feature (a 403 refusal) is simply left out, the way the single-class view shows it as "not
 * available"; any other failure rejects, so the page shows its usual error. Results keep the order of
 * `classIds`.
 */
export async function loadAcrossClasses<T>(classIds: string[], load: (classId: string) => Promise<T>): Promise<T[]> {
  const settled = await Promise.allSettled(classIds.map((classId) => load(classId)));
  const loaded: T[] = [];
  for (const result of settled) {
    if (result.status === "fulfilled") {
      loaded.push(result.value);
    } else if (!(result.reason instanceof ApiError && result.reason.status === 403)) {
      throw result.reason;
    }
  }
  return loaded;
}

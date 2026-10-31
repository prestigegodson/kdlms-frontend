import { useCallback, useEffect, useState } from "react";
import { getErrorMessage } from "@/api/client";
import {
  getClassInsights,
  getInsightsSummary,
  getStudentInsightTrend,
  isFeatureNotIncluded,
  type ClassInsightsView,
  type InsightSummaryView,
  type StudentInsightTrendView,
} from "@/api/insights";
import { getWardInsights, type WardInsightsView } from "@/api/wards";

/** `notIncluded`: the endpoint's `feature-not-included` 403, so a page can show the upgrade notice. */
export type LoadState<T> =
  | { kind: "loading" }
  | { kind: "loaded"; data: T }
  | { kind: "error"; message: string; notIncluded: boolean };

type Keyed<T> = { key: string; state: LoadState<T> };

/**
 * Loads `fetcher()` whenever `key` changes, ignoring a response that lands after the key moved on
 * (the `RegisterTab` keyed-state pattern). A `null` key loads nothing and stays `loading`.
 * `reload()` refetches the current key without flashing back to `loading`.
 */
function useKeyedLoad<T>(key: string | null, fetcher: () => Promise<T>, fallback: string) {
  const [result, setResult] = useState<Keyed<T> | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (key === null) {
      return;
    }
    let cancelled = false;
    fetcher()
      .then((data) => {
        if (!cancelled) {
          setResult({ key, state: { kind: "loaded", data } });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setResult({
            key,
            state: { kind: "error", message: getErrorMessage(error, fallback), notIncluded: isFeatureNotIncluded(error) },
          });
        }
      });
    return () => {
      cancelled = true;
    };
    // `fetcher` is recreated every render; `key` (plus `nonce`) is what identifies the request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, nonce]);

  const reload = useCallback(() => setNonce((value) => value + 1), []);
  const state: LoadState<T> = result !== null && result.key === key ? result.state : { kind: "loading" };
  return { state, reload };
}

export function useInsightsSummary() {
  return useKeyedLoad<InsightSummaryView>("summary", getInsightsSummary, "Failed to load student insights");
}

export function useClassInsights(classId: string | null) {
  return useKeyedLoad<ClassInsightsView>(
    classId,
    () => getClassInsights(classId as string),
    "Failed to load this class's insights",
  );
}

export function useStudentInsightTrend(studentId: string | undefined) {
  return useKeyedLoad<StudentInsightTrendView>(
    studentId ?? null,
    () => getStudentInsightTrend(studentId as string),
    "Failed to load this student's insights",
  );
}

export function useWardInsights(studentId: string) {
  return useKeyedLoad<WardInsightsView>(
    studentId,
    () => getWardInsights(studentId),
    "Failed to load this summary",
  );
}

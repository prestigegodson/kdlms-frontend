import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as featuresApi from "@/api/features";
import type { MyFeaturesView } from "@/api/features";
import { resetFeatureStore, useFeatureStore } from "@/stores/featureStore";

vi.mock("@/api/features");

const FEATURES: MyFeaturesView = {
  communication: true,
  timetable: true,
  lessonNotes: false,
  aiLessonNotes: false,
  takeHomeQuiz: true,
  billing: false,
  onDemandLearning: false,
  learningMedia: false,
  studentLogins: false,
  onlineClasses: false,
  interactiveQuestions: false,
  interactiveVideo: false,
  staffAttendance: false,
};

const MAX_AGE = 5 * 60_000;

describe("featureStore", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    resetFeatureStore();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("fetches once and caches the flags", async () => {
    vi.mocked(featuresApi.getMyFeatures).mockResolvedValue(FEATURES);

    await useFeatureStore.getState().fetchIfNeeded();
    await useFeatureStore.getState().fetchIfNeeded();

    expect(featuresApi.getMyFeatures).toHaveBeenCalledTimes(1);
    expect(useFeatureStore.getState()).toMatchObject({ status: "loaded", communication: true, timetable: true });
  });

  it("leaves every flag off when the first fetch fails", async () => {
    vi.mocked(featuresApi.getMyFeatures).mockRejectedValue(new TypeError("Failed to fetch"));

    await useFeatureStore.getState().fetchIfNeeded();

    expect(useFeatureStore.getState()).toMatchObject({ status: "error", communication: false, timetable: false });
  });

  it("revalidate retries a failed fetch, so the nav items come back without a reload", async () => {
    vi.mocked(featuresApi.getMyFeatures).mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await useFeatureStore.getState().fetchIfNeeded();

    vi.mocked(featuresApi.getMyFeatures).mockResolvedValue(FEATURES);
    await useFeatureStore.getState().revalidate(MAX_AGE);

    expect(useFeatureStore.getState()).toMatchObject({ status: "loaded", communication: true });
  });

  it("revalidate skips fresh flags and refetches stale ones", async () => {
    vi.useFakeTimers();
    vi.mocked(featuresApi.getMyFeatures).mockResolvedValue(FEATURES);
    await useFeatureStore.getState().fetchIfNeeded();

    await useFeatureStore.getState().revalidate(MAX_AGE);
    expect(featuresApi.getMyFeatures).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(MAX_AGE + 1);
    vi.mocked(featuresApi.getMyFeatures).mockResolvedValue({ ...FEATURES, billing: true });
    await useFeatureStore.getState().revalidate(MAX_AGE);

    expect(featuresApi.getMyFeatures).toHaveBeenCalledTimes(2);
    expect(useFeatureStore.getState().billing).toBe(true);
  });

  it("keeps the last loaded flags when a revalidation fails", async () => {
    vi.useFakeTimers();
    vi.mocked(featuresApi.getMyFeatures).mockResolvedValue(FEATURES);
    await useFeatureStore.getState().fetchIfNeeded();

    vi.advanceTimersByTime(MAX_AGE + 1);
    vi.mocked(featuresApi.getMyFeatures).mockRejectedValue(new TypeError("Failed to fetch"));
    await useFeatureStore.getState().revalidate(MAX_AGE);

    expect(useFeatureStore.getState()).toMatchObject({ status: "error", communication: true, timetable: true });
  });

  it("revalidate does nothing before the first fetch", async () => {
    await useFeatureStore.getState().revalidate(MAX_AGE);

    expect(featuresApi.getMyFeatures).not.toHaveBeenCalled();
  });

  it("ignores a fetch that resolves after reset", async () => {
    let resolve: (features: MyFeaturesView) => void = () => undefined;
    vi.mocked(featuresApi.getMyFeatures).mockReturnValue(new Promise((r) => (resolve = r)));

    const pending = useFeatureStore.getState().fetchIfNeeded();
    useFeatureStore.getState().reset();
    resolve(FEATURES);
    await pending;

    expect(useFeatureStore.getState()).toMatchObject({ status: "idle", communication: false });
  });
});

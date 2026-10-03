import { beforeEach, describe, expect, it, vi } from "vitest";
import * as onboardingApi from "@/api/onboarding";
import { resetAuthStore, useAuthStore } from "@/stores/authStore";
import { resetOnboardingStore, useOnboardingStore } from "@/stores/onboardingStore";

vi.mock("@/api/onboarding");

describe("onboardingStore", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    resetAuthStore();
    resetOnboardingStore();
    vi.mocked(onboardingApi.saveTourProgress).mockResolvedValue(undefined);
  });

  it("loads the caller's progress keyed by guide", async () => {
    vi.mocked(onboardingApi.getMyOnboarding).mockResolvedValue({
      autoStart: false,
      tours: [{ key: "shell.school", version: 1, status: "COMPLETED", stepIndex: 4, updatedAt: "x" }],
    });

    await useOnboardingStore.getState().fetchIfNeeded();
    await useOnboardingStore.getState().fetchIfNeeded();

    expect(onboardingApi.getMyOnboarding).toHaveBeenCalledTimes(1);
    expect(useOnboardingStore.getState()).toMatchObject({
      status: "loaded",
      autoStart: false,
      progress: { "shell.school": { status: "COMPLETED", stepIndex: 4 } },
    });
  });

  it("records progress optimistically and saves it", () => {
    useOnboardingStore.getState().record("school.students", 2, "SKIPPED", 1);

    expect(useOnboardingStore.getState().progress["school.students"]).toMatchObject({
      version: 2,
      status: "SKIPPED",
      stepIndex: 1,
    });
    expect(onboardingApi.saveTourProgress).toHaveBeenCalledWith("school.students", {
      version: 2,
      status: "SKIPPED",
      stepIndex: 1,
    });
  });

  it("saves nothing while impersonating", async () => {
    useAuthStore.setState({ impersonation: { sessionId: "s", expiresAt: "e" } });

    useOnboardingStore.getState().record("school.students", 1, "COMPLETED", 0);
    await useOnboardingStore.getState().setAutoStart(false);
    await useOnboardingStore.getState().resetAll();

    expect(useOnboardingStore.getState().progress).toEqual({});
    expect(useOnboardingStore.getState().autoStart).toBe(true);
    expect(onboardingApi.saveTourProgress).not.toHaveBeenCalled();
    expect(onboardingApi.updateOnboardingPreferences).not.toHaveBeenCalled();
    expect(onboardingApi.resetAllTours).not.toHaveBeenCalled();
  });

  it("rolls the auto-start switch back when saving it fails", async () => {
    vi.mocked(onboardingApi.updateOnboardingPreferences).mockRejectedValue(new Error("boom"));

    await expect(useOnboardingStore.getState().setAutoStart(false)).rejects.toThrow("boom");

    expect(useOnboardingStore.getState().autoStart).toBe(true);
  });

  it("clears every guide's progress on reset", async () => {
    vi.mocked(onboardingApi.resetAllTours).mockResolvedValue(undefined);
    useOnboardingStore.getState().record("shell.school", 1, "COMPLETED", 3);

    await useOnboardingStore.getState().resetAll();

    expect(useOnboardingStore.getState().progress).toEqual({});
  });
});

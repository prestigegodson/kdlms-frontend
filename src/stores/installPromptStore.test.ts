import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetInstallPromptStore, useInstallPromptStore } from "@/stores/installPromptStore";

function fakeEvent(outcome: "accepted" | "dismissed"): BeforeInstallPromptEvent {
  return {
    platforms: ["web"],
    prompt: vi.fn().mockResolvedValue(undefined),
    userChoice: Promise.resolve({ outcome, platform: "web" }),
  } as unknown as BeforeInstallPromptEvent;
}

describe("installPromptStore", () => {
  beforeEach(() => {
    resetInstallPromptStore();
  });

  it("dismiss stamps dismissedAt with the current time", () => {
    const before = Date.now();

    useInstallPromptStore.getState().dismiss();

    expect(useInstallPromptStore.getState().dismissedAt).toBeGreaterThanOrEqual(before);
  });

  it("markInstalled sets installed and clears any deferred prompt", () => {
    useInstallPromptStore.getState().setDeferredPrompt(fakeEvent("accepted"));

    useInstallPromptStore.getState().markInstalled();

    expect(useInstallPromptStore.getState()).toMatchObject({ installed: true, deferredPrompt: null });
  });

  it("promptInstall resolves false and does nothing when nothing is deferred - e.g. iOS, or an already-consumed prompt", async () => {
    const accepted = await useInstallPromptStore.getState().promptInstall();

    expect(accepted).toBe(false);
  });

  it("promptInstall fires the native dialog, consumes the deferred event, and resolves the user's choice", async () => {
    const event = fakeEvent("accepted");
    useInstallPromptStore.getState().setDeferredPrompt(event);

    const accepted = await useInstallPromptStore.getState().promptInstall();

    expect(accepted).toBe(true);
    expect(event.prompt).toHaveBeenCalledOnce();
    // Consumed regardless of outcome - a BeforeInstallPromptEvent can only
    // ever be prompted once.
    expect(useInstallPromptStore.getState().deferredPrompt).toBeNull();
  });

  it("promptInstall resolves false when the user declines the native dialog", async () => {
    useInstallPromptStore.getState().setDeferredPrompt(fakeEvent("dismissed"));

    const accepted = await useInstallPromptStore.getState().promptInstall();

    expect(accepted).toBe(false);
  });
});

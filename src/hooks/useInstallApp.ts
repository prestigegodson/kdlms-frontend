import { useState } from "react";
import { useInstallPromptStore } from "@/stores/installPromptStore";
import { detectInstallPlatform, isStandalone } from "@/utils/installPrompt";

const DISMISS_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Single source of truth for both install surfaces (`InstallBanner` and
 * PortalShell's drawer entry), so they can never disagree about whether
 * installing is currently possible. `platform`/`isStandalone()` are read
 * once per mount via `useState`'s lazy initializer - they don't change over
 * a session, unlike the store-backed fields below.
 */
export function useInstallApp() {
  const [platform] = useState(detectInstallPlatform);
  const [alreadyStandalone] = useState(isStandalone);
  // React's purity rule forbids calling Date.now() during render, but a
  // lazy useState initializer runs exactly once, at mount - captured here
  // rather than read fresh on every render so the dismissal check below
  // stays a pure comparison against props/state. A component that stays
  // mounted across the 30-day boundary won't reflect it until it remounts
  // (a page reload, in practice), which is an acceptable trade-off for a
  // dismissal window this long.
  const [mountedAt] = useState(() => Date.now());
  const deferredPrompt = useInstallPromptStore((state) => state.deferredPrompt);
  const installed = useInstallPromptStore((state) => state.installed);
  const dismissedAt = useInstallPromptStore((state) => state.dismissedAt);
  const dismiss = useInstallPromptStore((state) => state.dismiss);
  const promptInstall = useInstallPromptStore((state) => state.promptInstall);
  const [instructionsOpen, setInstructionsOpen] = useState(false);

  // iOS never fires beforeinstallprompt, so eligibility there is platform
  // alone; every other platform needs a real deferred event in hand.
  const canInstall =
    !installed && !alreadyStandalone && (deferredPrompt !== null || platform === "ios");

  const shouldShowBanner =
    canInstall && (dismissedAt === null || mountedAt - dismissedAt > DISMISS_WINDOW_MS);

  async function install() {
    if (platform === "ios") {
      // No native dialog exists on iOS Safari - the instructions modal is
      // the entire "install" action there.
      setInstructionsOpen(true);
      return;
    }
    // Fire-and-forget on Chromium: promptInstall() consumes the deferred
    // event either way, so canInstall (and with it the banner/drawer entry)
    // naturally goes false on accept or decline - a fresh
    // beforeinstallprompt later brings it back if the user stays eligible.
    await promptInstall();
  }

  return {
    platform,
    canInstall,
    shouldShowBanner,
    install,
    dismiss,
    instructionsOpen,
    closeInstructions: () => setInstructionsOpen(false),
  };
}

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { InstallBanner } from "@/layouts/InstallBanner";
import { resetInstallPromptStore, useInstallPromptStore } from "@/stores/installPromptStore";

// Mocked so no test here needs a real matchMedia/UA stub - installPrompt.ts
// is deliberately the one module in the app that touches those APIs, and
// useInstallApp (which InstallBanner is built on) reads them only through
// this module's two functions.
vi.mock("@/utils/installPrompt", async () => {
  const actual = await vi.importActual<typeof import("@/utils/installPrompt")>("@/utils/installPrompt");
  return { ...actual, isStandalone: vi.fn(() => false), detectInstallPlatform: vi.fn(() => "chromium") };
});

import { detectInstallPlatform, isStandalone } from "@/utils/installPrompt";

function fakeEvent(): BeforeInstallPromptEvent {
  return {
    platforms: ["web"],
    prompt: vi.fn().mockResolvedValue(undefined),
    userChoice: Promise.resolve({ outcome: "accepted" as const, platform: "web" }),
  } as unknown as BeforeInstallPromptEvent;
}

describe("InstallBanner", () => {
  beforeEach(() => {
    resetInstallPromptStore();
    vi.mocked(isStandalone).mockReturnValue(false);
    vi.mocked(detectInstallPlatform).mockReturnValue("chromium");
  });

  it("renders nothing when Chromium hasn't offered a deferred prompt yet", () => {
    render(<InstallBanner />);

    expect(screen.queryByText("Install KDLMS")).not.toBeInTheDocument();
  });

  it("renders once Chromium has deferred an install prompt", () => {
    useInstallPromptStore.getState().setDeferredPrompt(fakeEvent());

    render(<InstallBanner />);

    expect(screen.getByText("Install KDLMS")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Install" })).toBeInTheDocument();
  });

  it("renders unconditionally on iOS, which never fires a deferred prompt", () => {
    vi.mocked(detectInstallPlatform).mockReturnValue("ios");

    render(<InstallBanner />);

    expect(screen.getByRole("button", { name: "How to install" })).toBeInTheDocument();
  });

  it("renders nothing once the app is already installed", () => {
    useInstallPromptStore.getState().setDeferredPrompt(fakeEvent());
    useInstallPromptStore.getState().markInstalled();

    render(<InstallBanner />);

    expect(screen.queryByText("Install KDLMS")).not.toBeInTheDocument();
  });

  it("renders nothing when already running standalone", () => {
    vi.mocked(isStandalone).mockReturnValue(true);
    useInstallPromptStore.getState().setDeferredPrompt(fakeEvent());

    render(<InstallBanner />);

    expect(screen.queryByText("Install KDLMS")).not.toBeInTheDocument();
  });

  it("renders nothing when dismissed within the last 30 days", () => {
    useInstallPromptStore.getState().setDeferredPrompt(fakeEvent());
    useInstallPromptStore.setState({ dismissedAt: Date.now() - 1000 });

    render(<InstallBanner />);

    expect(screen.queryByText("Install KDLMS")).not.toBeInTheDocument();
  });

  it("renders again once the 30-day dismissal window has passed", () => {
    useInstallPromptStore.getState().setDeferredPrompt(fakeEvent());
    useInstallPromptStore.setState({ dismissedAt: Date.now() - 31 * 24 * 60 * 60 * 1000 });

    render(<InstallBanner />);

    expect(screen.getByText("Install KDLMS")).toBeInTheDocument();
  });

  it("dismissing hides the banner and persists the dismissal", async () => {
    const user = userEvent.setup();
    useInstallPromptStore.getState().setDeferredPrompt(fakeEvent());
    render(<InstallBanner />);

    await user.click(screen.getByRole("button", { name: "Not now" }));

    expect(screen.queryByText("Install KDLMS")).not.toBeInTheDocument();
    expect(useInstallPromptStore.getState().dismissedAt).not.toBeNull();
  });

  it("opens the how-to modal on iOS instead of firing a native dialog that doesn't exist there", async () => {
    const user = userEvent.setup();
    vi.mocked(detectInstallPlatform).mockReturnValue("ios");
    render(<InstallBanner />);

    await user.click(screen.getByRole("button", { name: "How to install" }));

    expect(screen.getByRole("dialog", { name: "How to install" })).toBeInTheDocument();
    expect(screen.getByText(/add to home screen/i)).toBeInTheDocument();
  });
});

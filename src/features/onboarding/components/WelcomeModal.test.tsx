import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as onboardingApi from "@/api/onboarding";
import { WelcomeModal } from "@/features/onboarding/components/WelcomeModal";
import { resetAuthStore, useAuthStore } from "@/stores/authStore";
import { resetOnboardingStore, useOnboardingStore } from "@/stores/onboardingStore";

vi.mock("@/api/onboarding");

function loaded(overrides: Partial<ReturnType<typeof useOnboardingStore.getState>> = {}) {
  useOnboardingStore.setState({ status: "loaded", autoStart: true, progress: {}, ...overrides });
}

describe("WelcomeModal", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(onboardingApi.saveTourProgress).mockResolvedValue(undefined);
    resetAuthStore();
    resetOnboardingStore();
    useAuthStore.setState({
      user: { id: "1", email: "t@school.example", firstName: "Ada", lastName: "Obi", role: "TEACHER", schoolId: "s" },
    });
  });

  it("welcomes a brand-new user and starts the shell guide", async () => {
    loaded();
    render(<WelcomeModal portal="school" role="TEACHER" />);

    expect(screen.getByRole("heading", { name: "Welcome to KDLMS, Ada" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Take the tour" }));

    expect(useOnboardingStore.getState().active).toMatchObject({ key: "shell.school", startIndex: 0 });
    expect(screen.queryByRole("heading", { name: /Welcome to KDLMS/ })).not.toBeInTheDocument();
  });

  it("records the shell guide as skipped on Skip for now", async () => {
    loaded();
    render(<WelcomeModal portal="school" role="TEACHER" />);

    await userEvent.click(screen.getByRole("button", { name: "Skip for now" }));

    expect(onboardingApi.saveTourProgress).toHaveBeenCalledWith("shell.school", {
      version: 1,
      status: "SKIPPED",
      stepIndex: 0,
    });
    expect(useOnboardingStore.getState().active).toBeNull();
  });

  it("stays closed once the shell guide has any progress, when guides are off, or while impersonating", () => {
    loaded({ progress: { "shell.school": { key: "shell.school", version: 1, status: "COMPLETED", stepIndex: 0, updatedAt: "" } } });
    const { rerender } = render(<WelcomeModal portal="school" role="TEACHER" />);
    expect(screen.queryByRole("button", { name: "Take the tour" })).not.toBeInTheDocument();

    loaded({ autoStart: false });
    rerender(<WelcomeModal portal="school" role="TEACHER" />);
    expect(screen.queryByRole("button", { name: "Take the tour" })).not.toBeInTheDocument();

    loaded();
    useAuthStore.setState({ impersonation: { sessionId: "s", expiresAt: "e" } });
    rerender(<WelcomeModal portal="school" role="TEACHER" />);
    expect(screen.queryByRole("button", { name: "Take the tour" })).not.toBeInTheDocument();
  });
});

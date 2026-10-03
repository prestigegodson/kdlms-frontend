import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as onboardingApi from "@/api/onboarding";
import type { TourProgressView } from "@/api/onboarding";
import { TourRunner } from "@/features/onboarding/components/TourRunner";
import { resetAuthStore, useAuthStore } from "@/stores/authStore";
import { resetOnboardingStore, useOnboardingStore } from "@/stores/onboardingStore";

vi.mock("@/api/onboarding");

// A stand-in for react-joyride: shows the current step and fires the same events the real one does.
vi.mock("react-joyride", () => ({
  ACTIONS: { NEXT: "next", PREV: "prev", SKIP: "skip" },
  EVENTS: { STEP_AFTER: "step:after", TARGET_NOT_FOUND: "error:target_not_found" },
  STATUS: { SKIPPED: "skipped", FINISHED: "finished" },
  Joyride: ({
    steps,
    stepIndex,
    onEvent,
  }: {
    steps: { title: string }[];
    stepIndex: number;
    onEvent: (data: object) => void;
  }) => (
    <div>
      <p>
        Step {stepIndex + 1}/{steps.length}: {steps[stepIndex]?.title}
      </p>
      <button type="button" onClick={() => onEvent({ type: "step:after", action: "next", index: stepIndex })}>
        mock next
      </button>
      <button
        type="button"
        onClick={() => onEvent({ type: "step:after", action: "skip", status: "skipped", index: stepIndex })}
      >
        mock skip
      </button>
    </div>
  ),
}));

function saved(key: string, overrides: Partial<TourProgressView> = {}): TourProgressView {
  return { key, version: 1, status: "COMPLETED", stepIndex: 0, updatedAt: "", ...overrides };
}

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      { path: "/guardian", element: <TourRunner portal="guardian" role="GUARDIAN" /> },
      { path: "/guardian/results", element: <TourRunner portal="guardian" role="GUARDIAN" /> },
    ],
    { initialEntries: [path] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

describe("TourRunner", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(onboardingApi.saveTourProgress).mockResolvedValue(undefined);
    resetAuthStore();
    resetOnboardingStore();
    useAuthStore.setState({
      user: { id: "1", email: "g@home.example", firstName: "Ngozi", lastName: "Eze", role: "GUARDIAN" },
    });
    useOnboardingStore.setState({
      status: "loaded",
      visibleNavHrefs: new Set(["/guardian", "/guardian/results"]),
    });
  });

  it("resumes a part-done shell guide at its saved step", () => {
    useOnboardingStore.setState({ progress: { "shell.guardian": saved("shell.guardian", { status: "IN_PROGRESS", stepIndex: 1 }) } });
    renderAt("/guardian");

    expect(screen.getByText(/Step 2\/5: Your children at a glance/)).toBeInTheDocument();
  });

  it("starts a page guide on its page once the shell guide is done, and records completion", async () => {
    useOnboardingStore.setState({ progress: { "shell.guardian": saved("shell.guardian") } });
    renderAt("/guardian/results");

    expect(await screen.findByText(/Step 1\/1: Report cards/, {}, { timeout: 2000 })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "mock next" }));

    expect(onboardingApi.saveTourProgress).toHaveBeenCalledWith("guardian.results", {
      version: 1,
      status: "COMPLETED",
      stepIndex: 0,
    });
    expect(useOnboardingStore.getState().active).toBeNull();
  });

  it("saves each step and records a skip", async () => {
    useOnboardingStore.setState({ progress: {} });
    act(() => useOnboardingStore.getState().start("shell.guardian"));
    renderAt("/guardian");

    await userEvent.click(screen.getByRole("button", { name: "mock next" }));
    expect(onboardingApi.saveTourProgress).toHaveBeenLastCalledWith("shell.guardian", {
      version: 1,
      status: "IN_PROGRESS",
      stepIndex: 1,
    });

    await userEvent.click(screen.getByRole("button", { name: "mock skip" }));
    expect(onboardingApi.saveTourProgress).toHaveBeenLastCalledWith("shell.guardian", {
      version: 1,
      status: "SKIPPED",
      stepIndex: 1,
    });
    expect(useOnboardingStore.getState().active).toBeNull();
  });

  it("never starts a guide on its own while impersonating, but a manual replay still plays", () => {
    useAuthStore.setState({ impersonation: { sessionId: "s", expiresAt: "e" } });
    useOnboardingStore.setState({ progress: { "shell.guardian": saved("shell.guardian", { status: "IN_PROGRESS" }) } });
    renderAt("/guardian");
    expect(screen.queryByText(/Step/)).not.toBeInTheDocument();

    act(() => useOnboardingStore.getState().start("shell.guardian", { manual: true }));
    expect(screen.getByText(/Step 1\/5/)).toBeInTheDocument();
  });

  it("stops a page guide when its page is left", async () => {
    useOnboardingStore.setState({ progress: { "shell.guardian": saved("shell.guardian") } });
    const router = renderAt("/guardian/results");
    await screen.findByText(/Report cards/, {}, { timeout: 2000 });

    await act(() => router.navigate("/guardian"));

    expect(useOnboardingStore.getState().active).toBeNull();
  });
});

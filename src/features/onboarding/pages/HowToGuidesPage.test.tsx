import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as onboardingApi from "@/api/onboarding";
import { HowToGuidesPage } from "@/features/onboarding/pages/HowToGuidesPage";
import { resetAuthStore, useAuthStore } from "@/stores/authStore";
import { resetOnboardingStore, useOnboardingStore } from "@/stores/onboardingStore";

vi.mock("@/api/onboarding");

function renderPage() {
  const router = createMemoryRouter(
    [
      { path: "/guardian/help", element: <HowToGuidesPage /> },
      { path: "/guardian/bills", element: <div>Bills page</div> },
    ],
    { initialEntries: ["/guardian/help"] },
  );
  render(<RouterProvider router={router} />);
}

describe("HowToGuidesPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    resetAuthStore();
    resetOnboardingStore();
    useAuthStore.setState({
      user: { id: "1", email: "g@home.example", firstName: "Ngozi", lastName: "Eze", role: "GUARDIAN" },
    });
    useOnboardingStore.setState({
      status: "loaded",
      // Messages isn't entitled at this school, so its guide isn't offered.
      visibleNavHrefs: new Set(["/guardian", "/guardian/results", "/guardian/bills", "/guardian/payments"]),
      progress: {
        "shell.guardian": { key: "shell.guardian", version: 1, status: "COMPLETED", stepIndex: 3, updatedAt: "" },
        "guardian.bills": { key: "guardian.bills", version: 1, status: "IN_PROGRESS", stepIndex: 1, updatedAt: "" },
      },
    });
  });

  it("groups every available guide by area with its status and progress", () => {
    renderPage();

    expect(screen.getByRole("heading", { name: "Getting started" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Fees" })).toBeInTheDocument();
    expect(screen.getByText("1 of 5 guides completed")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Messages" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Replay Welcome tour" })).toBeInTheDocument();
  });

  it("resumes a part-done guide on its own page", async () => {
    renderPage();

    await userEvent.click(screen.getByRole("button", { name: "Resume Bills" }));

    expect(screen.getByText("Bills page")).toBeInTheDocument();
    expect(useOnboardingStore.getState().active).toEqual({ key: "guardian.bills", startIndex: 1, manual: true });
  });

  it("resets every guide after confirming", async () => {
    vi.mocked(onboardingApi.resetAllTours).mockResolvedValue(undefined);
    renderPage();

    await userEvent.click(screen.getByRole("button", { name: "Reset all guides" }));
    await userEvent.click(screen.getByRole("button", { name: "Reset guides" }));

    expect(onboardingApi.resetAllTours).toHaveBeenCalled();
    expect(await screen.findByText("0 of 5 guides completed")).toBeInTheDocument();
  });
});

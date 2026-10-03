import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as onboardingApi from "@/api/onboarding";
import { HelpButton } from "@/features/onboarding/components/HelpButton";
import { resetAuthStore, useAuthStore } from "@/stores/authStore";
import { resetOnboardingStore, useOnboardingStore } from "@/stores/onboardingStore";

vi.mock("@/api/onboarding");

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      { path: "/school/students", element: <HelpButton portal="school" /> },
      { path: "/school/help", element: <div>All guides page</div> },
    ],
    { initialEntries: [path] },
  );
  render(<RouterProvider router={router} />);
}

describe("HelpButton", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    resetAuthStore();
    resetOnboardingStore();
    useAuthStore.setState({
      user: { id: "1", email: "a@school.example", firstName: "Ada", lastName: "Obi", role: "SCHOOL_ADMIN", schoolId: "s" },
    });
    useOnboardingStore.setState({
      status: "loaded",
      visibleNavHrefs: new Set(["/school", "/school/students"]),
      progress: {
        "school.students": { key: "school.students", version: 1, status: "COMPLETED", stepIndex: 0, updatedAt: "" },
      },
    });
  });

  it("lists this page's guide and the welcome tour, and replays one", async () => {
    renderAt("/school/students");

    await userEvent.click(screen.getByRole("button", { name: "Help and guides" }));

    expect(screen.getByText("Welcome tour")).toBeInTheDocument();
    expect(screen.getByText("Students")).toBeInTheDocument();
    expect(screen.getByText("Done")).toBeInTheDocument();
    expect(screen.queryByText("Your dashboard")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Replay Students" }));

    expect(useOnboardingStore.getState().active).toEqual({ key: "school.students", startIndex: 0, manual: true });
  });

  it("toggles automatic guides", async () => {
    vi.mocked(onboardingApi.updateOnboardingPreferences).mockResolvedValue(undefined);
    renderAt("/school/students");

    await userEvent.click(screen.getByRole("button", { name: "Help and guides" }));
    await userEvent.click(screen.getByRole("switch", { name: "Show guides automatically" }));

    expect(onboardingApi.updateOnboardingPreferences).toHaveBeenCalledWith(false);
    expect(screen.getByRole("switch", { name: "Show guides automatically" })).toHaveAttribute("aria-checked", "false");
  });

  it("links to every how-to guide", async () => {
    renderAt("/school/students");

    await userEvent.click(screen.getByRole("button", { name: "Help and guides" }));
    await userEvent.click(screen.getByRole("link", { name: "All how-to guides" }));

    expect(screen.getByText("All guides page")).toBeInTheDocument();
  });
});

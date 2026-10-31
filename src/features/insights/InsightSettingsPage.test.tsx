import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/api/client";
import * as insightsApi from "@/api/insights";
import type { InsightSettings } from "@/api/insights";
import { InsightSettingsPage } from "@/features/insights/InsightSettingsPage";
import { resetAuthStore, useAuthStore } from "@/stores/authStore";
import { resetFeatureStore, useFeatureStore } from "@/stores/featureStore";

vi.mock("@/api/insights", async () => {
  const actual = await vi.importActual<typeof import("@/api/insights")>("@/api/insights");
  return { ...actual, getInsightSettings: vi.fn(), saveInsightSettings: vi.fn() };
});

const defaults: InsightSettings = {
  averageDropPoints: 10,
  positionDropPercent: 25,
  failingSubjectsMin: 2,
  passMark: 40,
  attendanceRateMin: 80,
  absenceStreakDays: 3,
  missedQuizzesMin: 2,
  unopenedResourceDays: 14,
  unopenedResourcesMin: 1,
  guardianAlertsEnabled: true,
};

function renderPage() {
  resetAuthStore();
  useAuthStore.setState({
    user: { id: "u-1", email: "admin@school.example", firstName: "A", lastName: "B", role: "SCHOOL_ADMIN", schoolId: "school-1" },
    accessToken: "access",
    refreshToken: "refresh",
  });
  const router = createMemoryRouter([{ path: "/", element: <InsightSettingsPage /> }]);
  render(<RouterProvider router={router} />);
}

describe("InsightSettingsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetFeatureStore();
    useFeatureStore.setState({ studentInsights: true, status: "loaded" });
    vi.mocked(insightsApi.getInsightSettings).mockResolvedValue(defaults);
  });

  it("loads the current thresholds into the form", async () => {
    renderPage();

    expect(await screen.findByLabelText("Pass mark")).toHaveValue(40);
    expect(screen.getByLabelText("Minimum attendance (%)")).toHaveValue(80);
    expect(screen.getByLabelText("…after (days)")).toHaveValue(14);
  });

  it("saves the guardian alerts switch alongside the thresholds", async () => {
    vi.mocked(insightsApi.saveInsightSettings).mockImplementation((settings) => Promise.resolve(settings));
    renderPage();
    const toggle = await screen.findByRole("switch", { name: "Email guardians when a ward is at risk" });
    expect(toggle).toHaveAttribute("aria-checked", "true");

    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-checked", "false");
    await userEvent.click(screen.getByRole("button", { name: "Save settings" }));

    expect(insightsApi.saveInsightSettings).toHaveBeenCalledWith({ ...defaults, guardianAlertsEnabled: false });
  });

  it("saves the edited thresholds as numbers, keeping guardian alerts as they were", async () => {
    vi.mocked(insightsApi.saveInsightSettings).mockImplementation((settings) => Promise.resolve(settings));
    renderPage();
    const passMark = await screen.findByLabelText("Pass mark");

    await userEvent.clear(passMark);
    await userEvent.type(passMark, "45");
    await userEvent.click(screen.getByRole("button", { name: "Save settings" }));

    expect(insightsApi.saveInsightSettings).toHaveBeenCalledWith({ ...defaults, passMark: 45 });
    expect(await screen.findByText("Saved. Every class will be recomputed shortly.")).toBeInTheDocument();
  });

  it("shows the server's range message on a 422", async () => {
    vi.mocked(insightsApi.saveInsightSettings).mockRejectedValue(
      new ApiError(422, "Every count and day threshold must be at least 1.", {
        type: "https://kdlms.com/problems/business-rule-violation",
        detail: "Every count and day threshold must be at least 1.",
      }),
    );
    renderPage();
    await screen.findByLabelText("Pass mark");

    await userEvent.click(screen.getByRole("button", { name: "Save settings" }));

    expect(await screen.findByText("Every count and day threshold must be at least 1.")).toBeInTheDocument();
  });

  it("shows the upgrade notice when the school isn't entitled", async () => {
    useFeatureStore.setState({ studentInsights: false, status: "loaded" });
    renderPage();

    expect(await screen.findByText("Student insights aren't in your plan")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save settings" })).not.toBeInTheDocument();
  });
});

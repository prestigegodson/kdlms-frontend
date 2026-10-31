import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/api/client";
import * as insightsApi from "@/api/insights";
import type { InsightSummaryView } from "@/api/insights";
import { StudentsNeedingAttentionCard } from "@/features/insights/components/StudentsNeedingAttentionCard";

vi.mock("@/api/insights", async () => {
  const actual = await vi.importActual<typeof import("@/api/insights")>("@/api/insights");
  return { ...actual, getInsightsSummary: vi.fn() };
});

function renderCard() {
  const router = createMemoryRouter(
    [
      { path: "/", element: <StudentsNeedingAttentionCard /> },
      { path: "/school/insights", element: <div>Insights page</div> },
    ],
    { initialEntries: ["/"] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

const summary: InsightSummaryView = {
  termId: "t1",
  termName: "First Term",
  atRisk: 3,
  watch: 2,
  none: 40,
  computedAt: "2026-10-30T02:00:00Z",
  classes: [
    { classId: "c-quiet", className: "Primary 1", levelName: "Primary", atRisk: 0, watch: 0, total: 20 },
    { classId: "c-watch", className: "Primary 2", levelName: "Primary", atRisk: 0, watch: 2, total: 12 },
    { classId: "c-risk", className: "Primary 3", levelName: "Primary", atRisk: 3, watch: 0, total: 13 },
  ],
};

describe("StudentsNeedingAttentionCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the counts, the updated time, and flagged classes most at-risk first", async () => {
    vi.mocked(insightsApi.getInsightsSummary).mockResolvedValue(summary);

    renderCard();

    expect(await screen.findByText("At risk")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText(/First Term · Updated/)).toBeInTheDocument();
    const links = screen.getAllByRole("link").filter((link) => link.getAttribute("href")?.includes("classId="));
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/school/insights?classId=c-risk",
      "/school/insights?classId=c-watch",
    ]);
    expect(screen.queryByText("Primary 1")).not.toBeInTheDocument();
  });

  it("drills down to the insights page from a class row", async () => {
    vi.mocked(insightsApi.getInsightsSummary).mockResolvedValue(summary);
    const router = renderCard();

    await userEvent.click(await screen.findByText("Primary 3"));

    expect(router.state.location.pathname).toBe("/school/insights");
    expect(router.state.location.search).toBe("?classId=c-risk");
  });

  it("shows an all-clear state when nothing is flagged", async () => {
    vi.mocked(insightsApi.getInsightsSummary).mockResolvedValue({
      ...summary,
      atRisk: 0,
      watch: 0,
      classes: [summary.classes[0]],
    });

    renderCard();

    expect(await screen.findByText("All clear")).toBeInTheDocument();
  });

  it("says insights aren't computed yet when there is no computation time", async () => {
    vi.mocked(insightsApi.getInsightsSummary).mockResolvedValue({ ...summary, computedAt: undefined });

    renderCard();

    expect(await screen.findByText(/No insights yet/)).toBeInTheDocument();
    expect(screen.getByText(/Not computed yet/)).toBeInTheDocument();
  });

  it("renders nothing on a feature-not-included 403", async () => {
    vi.mocked(insightsApi.getInsightsSummary).mockRejectedValue(
      new ApiError(403, "Student insights are not included in the current plan.", {
        type: "https://kdlms.com/problems/feature-not-included",
        detail: "Student insights are not included in the current plan.",
      }),
    );

    renderCard();

    await vi.waitFor(() => expect(insightsApi.getInsightsSummary).toHaveBeenCalled());
    await vi.waitFor(() => expect(screen.queryByText("Students needing attention")).not.toBeInTheDocument());
  });
});

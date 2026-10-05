import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as creatorPlanApi from "@/api/creatorPlan";
import * as virtualClassesApi from "@/api/virtualClasses";
import type { Occurrence } from "@/api/virtualClasses";
import { CreatorDashboardPage } from "./CreatorDashboardPage";

vi.mock("@/api/creatorPlan");
vi.mock("@/api/virtualClasses");

const occurrence: Occurrence = {
  id: "o1",
  classId: "c1",
  className: "Algebra",
  slotId: null,
  scheduledStart: "2099-10-05T08:00:00Z",
  scheduledEnd: "2099-10-05T09:00:00Z",
  originalStart: "2099-10-05T08:00:00Z",
  status: "SCHEDULED",
  cancelReason: null,
  overridden: true,
  editable: true,
  joinable: true,
  startedAt: null,
  endedAt: null,
};

describe("CreatorDashboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(creatorPlanApi.getMyCreatorPlan).mockReturnValue(new Promise(() => undefined));
  });

  it("shows the creator's upcoming sessions in their own timezone with a Start button", async () => {
    vi.mocked(virtualClassesApi.listUpcomingOccurrences).mockResolvedValue({
      timezone: "Africa/Lagos",
      occurrences: [occurrence],
    });

    render(
      <MemoryRouter>
        <CreatorDashboardPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText("09:00–10:00 · Algebra")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start" })).toBeInTheDocument();
  });
});

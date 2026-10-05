import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as creatorPlanApi from "@/api/creatorPlan";
import type { CreatorPlanView } from "@/api/creatorPlan";
import { CreatorPlanCard } from "@/features/creators/components/CreatorPlanCard";

vi.mock("@/api/creatorPlan", async () => {
  const actual = await vi.importActual<typeof import("@/api/creatorPlan")>("@/api/creatorPlan");
  return { ...actual, getMyCreatorPlan: vi.fn() };
});

const FREE_PLAN: CreatorPlanView = {
  source: "SUBSCRIPTION",
  packageId: "pkg-free",
  planName: "Free",
  free: true,
  billingCycle: "MONTHLY",
  startDate: "2026-10-01",
  endDate: null,
  maxClasses: 1,
  maxStudentsPerClass: 10,
  maxSessionMinutes: 40,
  maxParticipantsPerSession: null,
  maxMonthlySessionHours: 10,
  lessonNotes: false,
  aiLessonNotes: false,
  aiGenerationLimit: 0,
  takeHomeQuiz: false,
  onDemandLearning: false,
  learningMedia: false,
  communication: true,
  guardianAccess: false,
  autoRenew: false,
  graceUntil: null,
};

function renderCard() {
  return render(
    <MemoryRouter>
      <CreatorPlanCard />
    </MemoryRouter>,
  );
}

describe("CreatorPlanCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the plan, its limits with blank as unlimited, and which features it includes", async () => {
    vi.mocked(creatorPlanApi.getMyCreatorPlan).mockResolvedValue(FREE_PLAN);

    renderCard();

    expect(await screen.findByText("No end date")).toBeInTheDocument();
    expect(screen.getByText("Free", { selector: "span" })).toBeInTheDocument();
    expect(screen.getByText("40 min")).toBeInTheDocument();
    expect(screen.getByText("Unlimited")).toBeInTheDocument();
    expect(screen.getByText("Class messaging")).toBeInTheDocument();
    expect(screen.getByText("No lesson notes")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Upgrade" })).toHaveAttribute("href", "/creator/billing");
  });

  it("says when a paid plan renews and warns while a failed renewal is retried", async () => {
    vi.mocked(creatorPlanApi.getMyCreatorPlan).mockResolvedValue({
      ...FREE_PLAN,
      planName: "Pro",
      free: false,
      endDate: "2026-11-05",
      autoRenew: true,
      graceUntil: "2026-11-08",
    });

    renderCard();

    expect(await screen.findByText("Renews 5 November, 2026")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Manage plan" })).toBeInTheDocument();
    expect(screen.getByText(/stays active until 8 November, 2026/)).toBeInTheDocument();
  });

  it("explains when there is no plan at all", async () => {
    vi.mocked(creatorPlanApi.getMyCreatorPlan).mockResolvedValue({
      ...FREE_PLAN,
      source: "NONE",
      planName: null,
      packageId: null,
    });

    renderCard();

    expect(await screen.findByText(/You don't have a plan yet/)).toBeInTheDocument();
  });
});

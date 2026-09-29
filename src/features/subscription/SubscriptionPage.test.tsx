import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as subscriptionsApi from "@/api/subscriptions";
import type { SubscriptionSummaryView } from "@/api/subscriptions";
import { SubscriptionPage } from "@/features/subscription/SubscriptionPage";

vi.mock("@/api/subscriptions", async () => {
  const actual = await vi.importActual<typeof import("@/api/subscriptions")>("@/api/subscriptions");
  return {
    ...actual,
    getMySubscription: vi.fn(),
  };
});

const ACTIVE_SUMMARY: SubscriptionSummaryView = {
  hasSubscription: true,
  packageName: "Growth",
  billingCycle: "ANNUAL",
  price: 5000,
  currency: "NGN",
  startDate: "2026-01-01",
  endDate: "2026-12-31",
  status: "ACTIVE",
  daysRemaining: 200,
  multiBranch: true,
  branchLimit: 5,
  branchesUsed: 1,
  activeStudentLimit: 500,
  activeStudentsUsed: 10,
  takeHomeQuiz: true,
  onDemandLearning: false,
  communication: false,
  timetable: false,
  lessonNotes: false,
  aiLessonNotes: false,
  aiGenerationLimit: 0,
  billing: false,
  freemium: false,
};

describe("SubscriptionPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the date range and days remaining for a non-freemium plan", async () => {
    vi.mocked(subscriptionsApi.getMySubscription).mockResolvedValue(ACTIVE_SUMMARY);

    render(<SubscriptionPage />);

    expect(await screen.findByText(/1 January, 2026 - 31 December, 2026/)).toBeInTheDocument();
    expect(screen.getByText(/200 days left/)).toBeInTheDocument();
  });

  it("hides the end date and days remaining for a freemium school", async () => {
    vi.mocked(subscriptionsApi.getMySubscription).mockResolvedValue({
      ...ACTIVE_SUMMARY,
      freemium: true,
    });

    render(<SubscriptionPage />);

    expect(await screen.findByText(/Since 1 January, 2026/)).toBeInTheDocument();
    expect(screen.queryByText(/31 December, 2026/)).not.toBeInTheDocument();
    expect(screen.queryByText(/days left/)).not.toBeInTheDocument();
  });
});

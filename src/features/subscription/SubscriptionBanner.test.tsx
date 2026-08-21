import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as subscriptionsApi from "@/api/subscriptions";
import type { SubscriptionSummaryView } from "@/api/subscriptions";
import { SubscriptionBanner } from "@/features/subscription/SubscriptionBanner";

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
};

describe("SubscriptionBanner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing for a healthy, non-expiring plan", async () => {
    vi.mocked(subscriptionsApi.getMySubscription).mockResolvedValue(ACTIVE_SUMMARY);

    const { container } = render(<SubscriptionBanner />);

    await waitFor(() => expect(subscriptionsApi.getMySubscription).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("warns when no subscription has been assigned", async () => {
    vi.mocked(subscriptionsApi.getMySubscription).mockResolvedValue({
      ...ACTIVE_SUMMARY,
      hasSubscription: false,
      status: "NONE",
    });

    render(<SubscriptionBanner />);

    expect(await screen.findByText(/no active subscription/i)).toBeInTheDocument();
  });

  it("warns when the subscription has expired", async () => {
    vi.mocked(subscriptionsApi.getMySubscription).mockResolvedValue({
      ...ACTIVE_SUMMARY,
      status: "EXPIRED",
    });

    render(<SubscriptionBanner />);

    expect(await screen.findByText(/expired on 31 December, 2026/i)).toBeInTheDocument();
  });

  it("warns when the subscription is expiring soon", async () => {
    vi.mocked(subscriptionsApi.getMySubscription).mockResolvedValue({
      ...ACTIVE_SUMMARY,
      daysRemaining: 5,
    });

    render(<SubscriptionBanner />);

    expect(await screen.findByText(/expires in 5 days/i)).toBeInTheDocument();
  });
});

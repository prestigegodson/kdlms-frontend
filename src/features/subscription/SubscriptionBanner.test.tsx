import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as subscriptionsApi from "@/api/subscriptions";
import type { SubscriptionSummaryView } from "@/api/subscriptions";
import type { Role } from "@/api/types";
import { SubscriptionBanner } from "@/features/subscription/SubscriptionBanner";
import { resetAuthStore, useAuthStore } from "@/stores/authStore";

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
  prices: [{ currency: "NGN", amountMinor: 500_000 }],
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
  graceUntil: null,
  autoRenew: false,
};

function signInAs(role: Role) {
  useAuthStore.setState({
    user: {
      id: "u1",
      email: "staff@school.example",
      firstName: "Ada",
      lastName: "Obi",
      role,
      schoolId: "school-1",
      emailVerified: true,
    },
  });
}

function renderBanner() {
  return render(
    <MemoryRouter>
      <SubscriptionBanner />
    </MemoryRouter>,
  );
}

describe("SubscriptionBanner", () => {
  beforeEach(() => {
    resetAuthStore();
    vi.clearAllMocks();
    signInAs("SCHOOL_ADMIN");
  });

  it("renders nothing for a healthy, non-expiring plan", async () => {
    vi.mocked(subscriptionsApi.getMySubscription).mockResolvedValue(ACTIVE_SUMMARY);

    const { container } = renderBanner();

    await waitFor(() => expect(subscriptionsApi.getMySubscription).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("warns when no subscription has been assigned, linking the school admin to a plan", async () => {
    vi.mocked(subscriptionsApi.getMySubscription).mockResolvedValue({
      ...ACTIVE_SUMMARY,
      hasSubscription: false,
      status: "NONE",
    });

    renderBanner();

    expect(await screen.findByText(/no active subscription/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Choose a plan" })).toHaveAttribute(
      "href",
      "/school/subscription",
    );
  });

  it("warns when the subscription has expired", async () => {
    vi.mocked(subscriptionsApi.getMySubscription).mockResolvedValue({
      ...ACTIVE_SUMMARY,
      status: "EXPIRED",
    });

    renderBanner();

    expect(await screen.findByText(/expired on 31 December, 2026/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Renew now" })).toBeInTheDocument();
  });

  it("tells other staff to ask the school admin rather than linking to billing", async () => {
    signInAs("TEACHER");
    vi.mocked(subscriptionsApi.getMySubscription).mockResolvedValue({
      ...ACTIVE_SUMMARY,
      status: "EXPIRED",
    });

    renderBanner();

    expect(await screen.findByText(/ask your school admin to renew it/i)).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("says a failed renewal is being retried while the plan stays active", async () => {
    vi.mocked(subscriptionsApi.getMySubscription).mockResolvedValue({
      ...ACTIVE_SUMMARY,
      endDate: "2026-10-04",
      daysRemaining: 0,
      graceUntil: "2026-10-07",
      autoRenew: true,
    });

    renderBanner();

    expect(await screen.findByText(/couldn't renew/i)).toBeInTheDocument();
    expect(screen.getByText(/stays active until 7 October, 2026/i)).toBeInTheDocument();
    expect(screen.queryByText(/expires in/i)).not.toBeInTheDocument();
  });

  it("warns when the subscription is expiring soon", async () => {
    vi.mocked(subscriptionsApi.getMySubscription).mockResolvedValue({
      ...ACTIVE_SUMMARY,
      daysRemaining: 5,
    });

    renderBanner();

    expect(await screen.findByText(/expires in 5 days/i)).toBeInTheDocument();
  });

  it("stays quiet about an expiring plan that renews itself", async () => {
    vi.mocked(subscriptionsApi.getMySubscription).mockResolvedValue({
      ...ACTIVE_SUMMARY,
      daysRemaining: 5,
      autoRenew: true,
    });

    const { container } = renderBanner();

    await waitFor(() => expect(subscriptionsApi.getMySubscription).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });
});

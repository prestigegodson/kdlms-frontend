import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as billingApi from "@/api/subscriptionBilling";
import * as subscriptionsApi from "@/api/subscriptions";
import type { SubscriptionSummaryView } from "@/api/subscriptions";
import { SubscriptionPage } from "@/features/subscription/SubscriptionPage";
import { EMPTY_PAGE, plan, subscription } from "@/features/subscriptionBilling/fixtures";
import { resetAuthStore, useAuthStore } from "@/stores/authStore";

vi.mock("@/api/subscriptionBilling");
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

const GROWTH = plan({
  id: "pkg-growth",
  name: "Growth",
  audience: "SCHOOL",
  billingCycle: "ANNUAL",
  prices: [{ currency: "NGN", amountMinor: 500_000 }],
  activeStudentLimit: 500,
  branchLimit: 5,
});
const SCALE = plan({
  id: "pkg-scale",
  name: "Scale",
  audience: "SCHOOL",
  billingCycle: "ANNUAL",
  prices: [{ currency: "NGN", amountMinor: 900_000 }],
  activeStudentLimit: 2000,
  branchLimit: 10,
});

/** The fixture school: Growth, assigned by the system admin for a bank transfer. */
const MANUAL_GROWTH = subscription({
  packageId: "pkg-growth",
  planName: "Growth",
  free: false,
  billingCycle: "ANNUAL",
  source: "MANUAL",
  startDate: "2026-01-01",
  endDate: "2026-12-31",
});

function renderPage(redirect = vi.fn()) {
  render(
    <MemoryRouter>
      <SubscriptionPage redirect={redirect} />
    </MemoryRouter>,
  );
  return redirect;
}

describe("SubscriptionPage", () => {
  beforeEach(() => {
    resetAuthStore();
    vi.clearAllMocks();
    useAuthStore.setState({
      user: {
        id: "u1",
        email: "owner@school.example",
        firstName: "Ada",
        lastName: "Obi",
        role: "SCHOOL_ADMIN",
        schoolId: "school-1",
        emailVerified: true,
      },
    });
    vi.mocked(billingApi.listBillablePlans).mockResolvedValue([SCALE, GROWTH]);
    vi.mocked(billingApi.getBillingSubscription).mockResolvedValue(MANUAL_GROWTH);
    vi.mocked(billingApi.listPaymentTransactions).mockResolvedValue(EMPTY_PAGE);
  });

  it("shows the date range and days remaining for a non-freemium plan", async () => {
    vi.mocked(subscriptionsApi.getMySubscription).mockResolvedValue(ACTIVE_SUMMARY);

    renderPage();

    expect(await screen.findByText(/1 January, 2026 - 31 December, 2026/)).toBeInTheDocument();
    expect(screen.getByText(/200 days left/)).toBeInTheDocument();
  });

  it("hides the end date and days remaining for a freemium school", async () => {
    vi.mocked(subscriptionsApi.getMySubscription).mockResolvedValue({
      ...ACTIVE_SUMMARY,
      freemium: true,
    });

    renderPage();

    expect(await screen.findByText(/Since 1 January, 2026/)).toBeInTheDocument();
    expect(screen.queryByText(/days left/)).not.toBeInTheDocument();
  });

  it("offers the school's plans, explains a manual plan has no card renewal, and renews it in place", async () => {
    vi.mocked(subscriptionsApi.getMySubscription).mockResolvedValue(ACTIVE_SUMMARY);

    renderPage();

    expect(
      await screen.findByRole("heading", { name: "Subscription & billing" }),
    ).toBeInTheDocument();
    expect(
      await screen.findByText(/assigned by KDLMS and ends on its end date/i),
    ).toBeInTheDocument();
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Choose Scale" })).toBeEnabled();

    // The same plan from a manual row extends it, so there's no "starts today" warning.
    await userEvent.click(screen.getByRole("button", { name: "Renew now" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).queryByText(/isn't carried over/)).not.toBeInTheDocument();
  });

  it("warns that a different plan starts today without carrying the manual plan's time over", async () => {
    vi.mocked(subscriptionsApi.getMySubscription).mockResolvedValue(ACTIVE_SUMMARY);
    vi.mocked(billingApi.checkout).mockResolvedValue({
      scheduled: false,
      activated: false,
      reference: "KDL-1",
      authorizationUrl: "https://checkout.paystack.com/abc",
      amountMinor: 900_000,
      discountMinor: 0,
      currency: "NGN",
    });
    const redirect = renderPage();

    await userEvent.click(await screen.findByRole("button", { name: "Choose Scale" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/Scale starts today/)).toBeInTheDocument();

    await userEvent.click(within(dialog).getByRole("button", { name: /^Pay / }));
    expect(billingApi.checkout).toHaveBeenCalledWith("pkg-scale", "NGN", null);
    expect(redirect).toHaveBeenCalledWith("https://checkout.paystack.com/abc");
  });

  it("tells a school with no plan that it is read-only until it chooses one", async () => {
    vi.mocked(subscriptionsApi.getMySubscription).mockResolvedValue({
      ...ACTIVE_SUMMARY,
      hasSubscription: false,
      status: "NONE",
    });
    vi.mocked(billingApi.getBillingSubscription).mockResolvedValue(
      subscription({ active: false, subscriptionId: null, packageId: null, planName: null }),
    );

    renderPage();

    expect(await screen.findByText("No active plan")).toBeInTheDocument();
    expect(
      await screen.findByText(/no active plan, so the portal is read-only/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Choose Growth" })).toBeEnabled();
  });
});

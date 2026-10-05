import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/api/client";
import * as creatorsApi from "@/api/creators";
import * as billingApi from "@/api/subscriptionBilling";
import { resetAuthStore, useAuthStore } from "@/stores/authStore";
import { EMPTY_PAGE, payment, plan, subscription } from "./fixtures";
import { PlanBillingPage } from "./PlanBillingPage";

vi.mock("@/api/subscriptionBilling");
vi.mock("@/api/creators", async () => {
  const actual = await vi.importActual<typeof import("@/api/creators")>("@/api/creators");
  return { ...actual, getMyCreatorProfile: vi.fn() };
});

const FREE = plan({ id: "pkg-free", name: "Free", free: true, prices: [], maxClasses: 1 });
const PRO = plan();
const BASIC = plan({
  id: "pkg-basic",
  name: "Basic",
  prices: [{ currency: "NGN", amountMinor: 200_000 }],
});
const PAID_PRO = subscription({
  packageId: "pkg-pro",
  planName: "Pro",
  free: false,
  source: "PAYSTACK",
  endDate: "2026-11-05",
  autoRenew: true,
  currency: "NGN",
  amountMinor: 500_000,
  card: { brand: "visa", last4: "4081", expMonth: "12", expYear: "2030", reusable: true },
});

function renderPage(redirect = vi.fn()) {
  render(
    <MemoryRouter>
      <PlanBillingPage redirect={redirect} />
    </MemoryRouter>,
  );
  return redirect;
}

describe("PlanBillingPage", () => {
  beforeEach(() => {
    resetAuthStore();
    vi.clearAllMocks();
    useAuthStore.setState({
      user: {
        id: "u1",
        email: "ada@example.com",
        firstName: "Ada",
        lastName: "L",
        role: "CREATOR",
        schoolId: "tenant-1",
        emailVerified: true,
      },
    });
    vi.mocked(creatorsApi.getMyCreatorProfile).mockRejectedValue(new Error("no profile"));
    vi.mocked(billingApi.listBillablePlans).mockResolvedValue([PRO, FREE, BASIC]);
    vi.mocked(billingApi.listPaymentTransactions).mockResolvedValue(EMPTY_PAGE);
  });

  it("starts a Paystack checkout for a plan and redirects to it", async () => {
    vi.mocked(billingApi.getBillingSubscription).mockResolvedValue(subscription());
    vi.mocked(billingApi.checkout).mockResolvedValue({
      scheduled: false,
      activated: false,
      reference: "KDL-1",
      authorizationUrl: "https://checkout.paystack.com/abc",
      amountMinor: 500_000,
      discountMinor: 0,
      currency: "NGN",
    });
    const redirect = renderPage();

    await userEvent.click(await screen.findByRole("button", { name: "Choose Pro" }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: /^Pay / }));

    expect(billingApi.checkout).toHaveBeenCalledWith("pkg-pro", "NGN", null);
    expect(redirect).toHaveBeenCalledWith("https://checkout.paystack.com/abc");
  });

  it("previews a coupon and checks out with it", async () => {
    vi.mocked(billingApi.getBillingSubscription).mockResolvedValue(subscription());
    vi.mocked(billingApi.validateCoupon).mockResolvedValue({
      code: "LAUNCH20",
      description: "Launch offer",
      duration: "REPEATING",
      durationPeriods: 3,
      currency: "NGN",
      listAmountMinor: 500_000,
      discountMinor: 100_000,
      amountDueMinor: 400_000,
    });
    vi.mocked(billingApi.checkout).mockResolvedValue({
      scheduled: false,
      activated: false,
      reference: "KDL-2",
      authorizationUrl: "https://checkout.paystack.com/def",
      amountMinor: 400_000,
      discountMinor: 100_000,
      currency: "NGN",
    });
    const redirect = renderPage();

    await userEvent.click(await screen.findByRole("button", { name: "Choose Pro" }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText("Coupon code"), "launch20");
    await userEvent.click(within(dialog).getByRole("button", { name: "Apply" }));

    expect(billingApi.validateCoupon).toHaveBeenCalledWith("launch20", "pkg-pro", "NGN");
    expect(await within(dialog).findByText(/first 3 payments/)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: /^Pay .*4,000/ }));

    expect(billingApi.checkout).toHaveBeenCalledWith("pkg-pro", "NGN", "LAUNCH20");
    expect(redirect).toHaveBeenCalledWith("https://checkout.paystack.com/def");
  });

  it("shows why a coupon can't be used", async () => {
    vi.mocked(billingApi.getBillingSubscription).mockResolvedValue(subscription());
    vi.mocked(billingApi.validateCoupon).mockRejectedValue(
      new ApiError(422, "This coupon has expired."),
    );
    renderPage();

    await userEvent.click(await screen.findByRole("button", { name: "Choose Pro" }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText("Coupon code"), "OLD");
    await userEvent.click(within(dialog).getByRole("button", { name: "Apply" }));

    expect(await within(dialog).findByText("This coupon has expired.")).toBeInTheDocument();
  });

  it("activates a plan a coupon covers in full without redirecting", async () => {
    vi.mocked(billingApi.getBillingSubscription).mockResolvedValue(subscription());
    vi.mocked(billingApi.validateCoupon).mockResolvedValue({
      code: "FREEPRO",
      description: null,
      duration: "ONCE",
      durationPeriods: null,
      currency: "NGN",
      listAmountMinor: 500_000,
      discountMinor: 500_000,
      amountDueMinor: 0,
    });
    vi.mocked(billingApi.checkout).mockResolvedValue({
      scheduled: false,
      activated: true,
      reference: "KDL-3",
      authorizationUrl: null,
      amountMinor: 0,
      discountMinor: 500_000,
      currency: "NGN",
    });
    const redirect = renderPage();

    await userEvent.click(await screen.findByRole("button", { name: "Choose Pro" }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText("Coupon code"), "FREEPRO");
    await userEvent.click(within(dialog).getByRole("button", { name: "Apply" }));
    await userEvent.click(await within(dialog).findByRole("button", { name: "Activate plan" }));

    expect(redirect).not.toHaveBeenCalled();
    expect(await screen.findByText(/coupon covered the full price/)).toBeInTheDocument();
    expect(billingApi.getBillingSubscription).toHaveBeenCalledTimes(2);
  });

  it("prices plans in the chosen currency and disables one with no price there", async () => {
    vi.mocked(billingApi.getBillingSubscription).mockResolvedValue(subscription());
    renderPage();

    await screen.findByRole("button", { name: "Choose Pro" });
    await userEvent.selectOptions(screen.getByLabelText("Currency"), "USD");

    expect(screen.getAllByRole("button", { name: "Not available in USD" })).toHaveLength(2);
  });

  it("schedules a cheaper plan instead of charging and reloads the subscription", async () => {
    vi.mocked(billingApi.getBillingSubscription)
      .mockResolvedValueOnce(PAID_PRO)
      .mockResolvedValue({
        ...PAID_PRO,
        scheduledPackageId: "pkg-basic",
        scheduledPlanName: "Basic",
      });
    vi.mocked(billingApi.checkout).mockResolvedValue({
      scheduled: true,
      activated: false,
      reference: null,
      authorizationUrl: null,
      amountMinor: 0,
      discountMinor: 0,
      currency: "NGN",
    });
    const redirect = renderPage();

    expect(
      await screen.findByText("Visa ending 4081 · expires 12/2030", { exact: false }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Your current plan" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Choose Basic" }));
    await userEvent.click(
      within(await screen.findByRole("dialog")).getByRole("button", { name: /^Pay / }),
    );

    expect(redirect).not.toHaveBeenCalled();
    expect(
      await screen.findByText(/Basic will start when your current plan renews/),
    ).toBeInTheDocument();
    expect(await screen.findByText(/You'll move to/)).toBeInTheDocument();
  });

  it("asks before turning auto-renewal off", async () => {
    vi.mocked(billingApi.getBillingSubscription).mockResolvedValue(PAID_PRO);
    vi.mocked(billingApi.setAutoRenew).mockResolvedValue({ ...PAID_PRO, autoRenew: false });
    renderPage();

    await userEvent.click(await screen.findByRole("switch", { name: "Renew automatically" }));
    const dialog = await screen.findByRole("dialog");
    expect(billingApi.setAutoRenew).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole("button", { name: "Turn off" }));

    expect(billingApi.setAutoRenew).toHaveBeenCalledWith(false);
    expect(await screen.findByText("Ends 5 November, 2026")).toBeInTheDocument();
  });

  it("warns while a failed renewal is being retried and lists past payments", async () => {
    vi.mocked(billingApi.getBillingSubscription).mockResolvedValue({
      ...PAID_PRO,
      renewalPending: true,
      graceUntil: "2026-11-08",
    });
    vi.mocked(billingApi.listPaymentTransactions).mockResolvedValue({
      ...EMPTY_PAGE,
      content: [
        payment(),
        payment({ id: "tx-2", reference: "KDL-2", status: "FAILED", purpose: "RENEWAL" }),
      ],
      totalElements: 2,
      totalPages: 1,
    });
    renderPage();

    expect(await screen.findByText("We couldn't renew your plan")).toBeInTheDocument();
    expect(screen.getByText(/plan stays active until 8 November, 2026/)).toBeInTheDocument();
    expect(await screen.findByText("KDL-2")).toBeInTheDocument();
    expect(screen.getAllByText("Failed").length).toBeGreaterThan(0);
  });
});

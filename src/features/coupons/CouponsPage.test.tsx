import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as couponsApi from "@/api/coupons";
import type { CouponView } from "@/api/coupons";
import * as packagesApi from "@/api/packages";
import { plan } from "../subscriptionBilling/fixtures";
import { CouponsPage } from "./CouponsPage";

vi.mock("@/api/coupons");
vi.mock("@/api/packages");

const EMPTY = { content: [], totalElements: 0, totalPages: 0, number: 0, size: 20 };

function coupon(overrides: Partial<CouponView> = {}): CouponView {
  return {
    id: "c1",
    code: "LAUNCH20",
    description: "Launch offer",
    type: "PERCENT",
    value: 20,
    currency: null,
    duration: "REPEATING",
    durationPeriods: 3,
    audience: "CREATOR",
    validFrom: "2026-10-01T00:00:00Z",
    validUntil: null,
    maxRedemptions: 100,
    status: "ACTIVE",
    packages: [],
    pendingRedemptions: 1,
    redeemedRedemptions: 4,
    deletable: false,
    createdAt: "2026-10-01T00:00:00Z",
    updatedAt: "2026-10-01T00:00:00Z",
    ...overrides,
  };
}

function page(content: CouponView[]) {
  return { ...EMPTY, content, totalElements: content.length, totalPages: 1 };
}

describe("CouponsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(packagesApi.listPackages).mockResolvedValue({
      ...EMPTY,
      content: [plan(), plan({ id: "pkg-school", name: "School Plus", audience: "SCHOOL" })],
      totalElements: 2,
      totalPages: 1,
    });
  });

  it("lists coupons with their terms and usage", async () => {
    vi.mocked(couponsApi.listCoupons).mockResolvedValue(page([coupon()]));
    render(<CouponsPage />);

    expect(await screen.findByText("LAUNCH20")).toBeInTheDocument();
    expect(screen.getByText("20% off")).toBeInTheDocument();
    expect(screen.getByText("first 3 payments")).toBeInTheDocument();
    expect(screen.getByText("4 / 100")).toBeInTheDocument();
    expect(screen.getByText("1 awaiting payment")).toBeInTheDocument();
    expect(couponsApi.listCoupons).toHaveBeenCalledWith("", "", 0, 20);
  });

  it("creates a fixed-amount coupon limited to one plan", async () => {
    vi.mocked(couponsApi.listCoupons).mockResolvedValue(page([]));
    vi.mocked(couponsApi.createCoupon).mockResolvedValue(coupon({ code: "FLAT5K" }));
    render(<CouponsPage />);

    await userEvent.click(await screen.findByRole("button", { name: /New coupon/ }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(within(dialog).getByLabelText("Code"), "flat5k");
    await userEvent.selectOptions(within(dialog).getByLabelText("Discount type"), "FIXED");
    await userEvent.type(within(dialog).getByLabelText("Amount off"), "5000");
    // Only creator plans are offered for a creator coupon.
    expect(within(dialog).queryByText("School Plus")).not.toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("checkbox", { name: /Pro/ }));
    await userEvent.click(within(dialog).getByRole("button", { name: "Create coupon" }));

    expect(couponsApi.createCoupon).toHaveBeenCalledWith(
      expect.objectContaining({
        code: "FLAT5K",
        type: "FIXED",
        value: 500_000,
        currency: "NGN",
        duration: "ONCE",
        durationPeriods: null,
        audience: "CREATOR",
        packageIds: ["pkg-pro"],
        maxRedemptions: null,
      }),
    );
  });

  it("locks a coupon's terms when editing it", async () => {
    vi.mocked(couponsApi.listCoupons).mockResolvedValue(page([coupon()]));
    render(<CouponsPage />);

    await userEvent.click(await screen.findByRole("button", { name: "Actions for LAUNCH20" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Edit" }));
    const dialog = await screen.findByRole("dialog");

    expect(within(dialog).getByLabelText("Code")).toBeDisabled();
    expect(within(dialog).getByLabelText("Percent off")).toBeDisabled();
    expect(within(dialog).getByLabelText("Redemption limit")).toBeEnabled();
  });

  it("offers delete only for a coupon nobody has used", async () => {
    vi.mocked(couponsApi.listCoupons).mockResolvedValue(page([coupon({ deletable: true })]));
    vi.mocked(couponsApi.deleteCoupon).mockResolvedValue(undefined);
    render(<CouponsPage />);

    await userEvent.click(await screen.findByRole("button", { name: "Actions for LAUNCH20" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Delete" }));
    await userEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Delete" }));

    expect(couponsApi.deleteCoupon).toHaveBeenCalledWith("c1");
  });
});

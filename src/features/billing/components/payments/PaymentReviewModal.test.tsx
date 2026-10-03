import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/api/client";
import * as api from "@/api/staffFeePayments";
import { PaymentReviewModal } from "@/features/billing/components/payments/PaymentReviewModal";
import {
  allocation,
  paymentView,
  termStatus,
} from "@/features/billing/components/payments/testFixtures";
import { resetPendingFeePaymentsStore } from "@/stores/pendingFeePaymentsStore";

vi.mock("@/api/staffFeePayments", async () => {
  const actual =
    await vi.importActual<typeof import("@/api/staffFeePayments")>("@/api/staffFeePayments");
  return {
    ...actual,
    getFeePayment: vi.fn(),
    reviewFeePayment: vi.fn(),
    getPendingPaymentCount: vi.fn(),
    downloadStaffPaymentAttachment: vi.fn(),
    voidAllocation: vi.fn(),
  };
});

function renderModal(onChanged = vi.fn()) {
  render(<PaymentReviewModal paymentId="payment-1" onClose={vi.fn()} onChanged={onChanged} />);
  return onChanged;
}

describe("PaymentReviewModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetPendingFeePaymentsStore();
    vi.mocked(api.getPendingPaymentCount).mockResolvedValue({ count: 0 });
  });

  it("pre-selects the settlement from the balance and follows the amount as it's edited", async () => {
    const user = userEvent.setup();
    vi.mocked(api.getFeePayment).mockResolvedValue(
      paymentView({
        allocations: [allocation({ termStatus: termStatus({ confirmedPaid: 30000 }) })],
      }),
    );
    renderModal();

    await user.click(await screen.findByRole("radio", { name: "Confirm" }));
    // 30,000 confirmed + 20,000 claimed covers the 50,000 bill.
    expect(screen.getByRole("radio", { name: "Paid in full" })).toBeChecked();

    const amount = screen.getByLabelText("Confirmed amount");
    await user.clear(amount);
    await user.type(amount, "15000");
    expect(screen.getByRole("radio", { name: "Part payment" })).toBeChecked();
  });

  it("warns on a settlement that disagrees with the balance, but still sends the admin's choice", async () => {
    const user = userEvent.setup();
    vi.mocked(api.getFeePayment).mockResolvedValue(paymentView());
    vi.mocked(api.reviewFeePayment).mockResolvedValue(
      paymentView({
        allocations: [
          allocation({ status: "CONFIRMED", confirmedAmount: 20000, settlement: "FULL" }),
        ],
      }),
    );
    const onChanged = renderModal();

    await user.click(await screen.findByRole("radio", { name: "Confirm" }));
    expect(screen.getByRole("radio", { name: "Part payment" })).toBeChecked();
    await user.click(screen.getByRole("radio", { name: "Paid in full" }));
    expect(screen.getByText(/balance isn't fully covered yet/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Submit review" }));

    expect(api.reviewFeePayment).toHaveBeenCalledWith("payment-1", [
      {
        allocationId: "alloc-1",
        version: 3,
        action: "CONFIRM",
        confirmedAmount: 20000,
        settlement: "FULL",
        optionalFeeIds: [],
        reason: null,
      },
    ]);
    expect(await screen.findByText("Review saved.")).toBeInTheDocument();
    expect(onChanged).toHaveBeenCalled();
    expect(api.getPendingPaymentCount).toHaveBeenCalled();
  });

  it("requires a reason before a rejection can be submitted", async () => {
    const user = userEvent.setup();
    vi.mocked(api.getFeePayment).mockResolvedValue(paymentView());
    vi.mocked(api.reviewFeePayment).mockResolvedValue(paymentView());
    renderModal();

    const submit = await screen.findByRole("button", { name: "Submit review" });
    expect(submit).toBeDisabled();
    await user.click(screen.getByRole("radio", { name: "Reject" }));
    expect(submit).toBeDisabled();

    await user.type(screen.getByLabelText("Reason for rejecting"), "Slip is for another school");
    expect(submit).toBeEnabled();
    await user.click(submit);

    expect(api.reviewFeePayment).toHaveBeenCalledWith("payment-1", [
      expect.objectContaining({
        action: "REJECT",
        reason: "Slip is for another school",
        version: 3,
      }),
    ]);
  });

  it("sends the optional fees ticked at confirm", async () => {
    const user = userEvent.setup();
    vi.mocked(api.getFeePayment).mockResolvedValue(
      paymentView({
        allocations: [
          allocation({
            optionalFees: [{ feeId: "fee-x", feeName: "Excursion", amount: 5000, applied: false }],
            bill: {
              billReference: "B-1",
              total: 50000,
              published: true,
              tickableOptionalFees: [
                { feeId: "fee-x", feeName: "Excursion", amount: 5000, applied: false },
                { feeId: "fee-y", feeName: "Club", amount: 3000, applied: false },
              ],
            },
          }),
        ],
      }),
    );
    vi.mocked(api.reviewFeePayment).mockResolvedValue(paymentView());
    renderModal();

    await user.click(await screen.findByRole("radio", { name: "Confirm" }));
    // The guardian's own tick is carried over; the admin adds another.
    expect(screen.getByRole("checkbox", { name: /Excursion/ })).toBeChecked();
    await user.click(screen.getByRole("checkbox", { name: /Club/ }));
    await user.click(screen.getByRole("button", { name: "Submit review" }));

    expect(api.reviewFeePayment).toHaveBeenCalledWith("payment-1", [
      expect.objectContaining({ optionalFeeIds: ["fee-x", "fee-y"] }),
    ]);
  });

  it("reloads the payment when a concurrent review makes this one stale", async () => {
    const user = userEvent.setup();
    vi.mocked(api.getFeePayment)
      .mockResolvedValueOnce(paymentView())
      .mockResolvedValueOnce(
        paymentView({
          allocations: [allocation({ status: "REJECTED", reason: "Duplicate", version: 4 })],
        }),
      );
    vi.mocked(api.reviewFeePayment).mockRejectedValue(new ApiError(409, "Conflict"));
    renderModal();

    await user.click(await screen.findByRole("radio", { name: "Confirm" }));
    await user.click(screen.getByRole("button", { name: "Submit review" }));

    expect(await screen.findByText(/changed while you were reviewing it/)).toBeInTheDocument();
    expect(await screen.findByText("Duplicate")).toBeInTheDocument();
    expect(api.getFeePayment).toHaveBeenCalledTimes(2);
  });

  it("voids a confirmed child only once a reason is given", async () => {
    const user = userEvent.setup();
    vi.mocked(api.getFeePayment).mockResolvedValue(
      paymentView({
        allocations: [
          allocation({ status: "CONFIRMED", confirmedAmount: 20000, settlement: "PARTIAL" }),
        ],
      }),
    );
    vi.mocked(api.voidAllocation).mockResolvedValue(
      paymentView({ allocations: [allocation({ status: "VOIDED", reason: "Bounced" })] }),
    );
    renderModal();

    await user.click(await screen.findByRole("button", { name: "Void" }));
    const dialog = screen.getByRole("dialog", { name: "Void payment" });
    const confirm = within(dialog).getByRole("button", { name: "Void payment" });
    expect(confirm).toBeDisabled();
    await user.type(within(dialog).getByLabelText("Reason"), "Bounced");
    await user.click(confirm);

    expect(api.voidAllocation).toHaveBeenCalledWith("alloc-1", "Bounced");
    expect(await screen.findByText("Voided")).toBeInTheDocument();
  });
});

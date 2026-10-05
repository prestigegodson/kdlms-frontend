import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as billingApi from "@/api/subscriptionBilling";
import { EMPTY_PAGE, payment } from "./fixtures";
import { PaymentTransactionsPage } from "./PaymentTransactionsPage";

vi.mock("@/api/subscriptionBilling");

describe("PaymentTransactionsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists every tenant's payments and filters by status", async () => {
    vi.mocked(billingApi.listAdminPaymentTransactions).mockResolvedValue({
      ...EMPTY_PAGE,
      content: [payment({ schoolName: "Ada's Studio" })],
      totalElements: 1,
      totalPages: 1,
    });
    render(<PaymentTransactionsPage />);

    expect(await screen.findByText("Ada's Studio")).toBeInTheDocument();
    expect(screen.getByText("Paid", { selector: "span" })).toBeInTheDocument();
    expect(billingApi.listAdminPaymentTransactions).toHaveBeenCalledWith("", 0, 20);

    vi.mocked(billingApi.listAdminPaymentTransactions).mockResolvedValue(EMPTY_PAGE);
    await userEvent.selectOptions(screen.getByLabelText("Status"), "FAILED");

    expect(billingApi.listAdminPaymentTransactions).toHaveBeenLastCalledWith("FAILED", 0, 20);
    expect(await screen.findByText("No payments have this status.")).toBeInTheDocument();
  });
});

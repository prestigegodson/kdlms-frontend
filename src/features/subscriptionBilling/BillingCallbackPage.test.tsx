import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as billingApi from "@/api/subscriptionBilling";
import { BillingCallbackPage } from "./BillingCallbackPage";
import { payment } from "./fixtures";
import { POLL_INTERVAL_MS, POLL_TIMEOUT_MS } from "./useTransactionPoll";

vi.mock("@/api/subscriptionBilling");

function renderAt(url: string) {
  const router = createMemoryRouter(
    [{ path: "/billing/callback", element: <BillingCallbackPage /> }],
    {
      initialEntries: [url],
    },
  );
  render(<RouterProvider router={router} />);
}

describe("BillingCallbackPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("polls until the webhook has settled the payment", async () => {
    vi.mocked(billingApi.getPaymentTransaction).mockResolvedValue(payment({ status: "PENDING" }));
    renderAt("/billing/callback?trxref=KDL-1&reference=KDL-1");

    expect(await screen.findByText("Confirming your payment…")).toBeInTheDocument();
    expect(billingApi.getPaymentTransaction).toHaveBeenCalledWith("KDL-1");

    vi.mocked(billingApi.getPaymentTransaction).mockResolvedValue(payment({ status: "SUCCESS" }));
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);

    expect(await screen.findByText("Payment received")).toBeInTheDocument();
    const calls = vi.mocked(billingApi.getPaymentTransaction).mock.calls.length;
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS * 3);
    expect(vi.mocked(billingApi.getPaymentTransaction).mock.calls.length).toBe(calls);
  });

  it("explains a payment that didn't go through", async () => {
    vi.mocked(billingApi.getPaymentTransaction).mockResolvedValue(
      payment({ status: "FAILED", gatewayMessage: "Declined by your bank." }),
    );
    renderAt("/billing/callback?reference=KDL-1");

    expect(await screen.findByText("Payment not completed")).toBeInTheDocument();
    expect(screen.getByText(/Declined by your bank/)).toBeInTheDocument();
  });

  it("stops waiting after a while without calling it a failure", async () => {
    vi.mocked(billingApi.getPaymentTransaction).mockResolvedValue(payment({ status: "PENDING" }));
    renderAt("/billing/callback?reference=KDL-1");

    await screen.findByText("Confirming your payment…");
    await vi.advanceTimersByTimeAsync(POLL_TIMEOUT_MS + POLL_INTERVAL_MS);

    expect(await screen.findByText("Still processing")).toBeInTheDocument();
    expect(screen.getByText(/you don't need to pay again/)).toBeInTheDocument();
  });

  it("needs a reference", async () => {
    renderAt("/billing/callback");
    expect(await screen.findByText("No payment reference.")).toBeInTheDocument();
    expect(billingApi.getPaymentTransaction).not.toHaveBeenCalled();
  });
});

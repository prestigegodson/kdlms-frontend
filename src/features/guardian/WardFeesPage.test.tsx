import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as feePaymentsApi from "@/api/feePayments";
import type { WardFeePaymentView, WardFeeTermView } from "@/api/feePayments";
import * as wardsApi from "@/api/wards";
import type { BillView } from "@/api/billing";
import { WardFeesPage } from "@/features/guardian/WardFeesPage";
import { resetAuthStore, useAuthStore } from "@/stores/authStore";
import { resetFeatureStore, useFeatureStore } from "@/stores/featureStore";
import { resetWardStore } from "@/stores/wardStore";
import { downloadBlob } from "@/utils/download";

vi.mock("@/api/wards", async () => {
  const actual = await vi.importActual<typeof import("@/api/wards")>("@/api/wards");
  return { ...actual, listMyWards: vi.fn(), getWardBill: vi.fn(), downloadWardBillPdf: vi.fn() };
});

vi.mock("@/api/feePayments", async () => {
  const actual = await vi.importActual<typeof import("@/api/feePayments")>("@/api/feePayments");
  return {
    ...actual,
    getWardFees: vi.fn(),
    withdrawFeePayment: vi.fn(),
    downloadFeeReceiptPdf: vi.fn(),
    downloadFeePaymentAttachment: vi.fn(),
  };
});

vi.mock("@/utils/download", () => ({ downloadBlob: vi.fn() }));

const WARD = {
  studentId: "s1",
  fullName: "Ada Obi",
  admissionNumber: "SCH/2026/0001",
  relationship: "MOTHER",
  gender: "FEMALE" as const,
  currentClassName: "Primary 3",
  status: "ACTIVE",
  schoolId: "school-1",
  schoolName: "Bright Star Academy",
};

function payment(overrides: Partial<WardFeePaymentView> = {}): WardFeePaymentView {
  return {
    paymentId: "p1",
    allocationId: "a1",
    status: "PENDING",
    claimedAmount: 20000,
    confirmedAmount: null,
    settlement: null,
    reason: null,
    paymentDate: "2026-09-20",
    method: "BANK_TRANSFER",
    payerName: "Gina G",
    note: null,
    totalAmount: 20000,
    childCount: 1,
    submittedAt: "2026-09-20T10:00:00Z",
    submittedByMe: true,
    canEdit: true,
    optionalFees: [],
    attachments: [{ fileId: "f1", fileName: "teller.jpg", contentType: "image/jpeg", sizeBytes: 1000 }],
    receipts: [],
    ...overrides,
  };
}

function term(overrides: Partial<WardFeeTermView> = {}): WardFeeTermView {
  return {
    sessionId: "session-1",
    sessionName: "2026/2027",
    termId: "term-1",
    termName: "First Term",
    termNumber: 1,
    current: true,
    advance: false,
    published: true,
    billReference: "SCH/2026/0001-T1",
    currency: "NGN",
    billed: 50000,
    confirmedPaid: 10000,
    pendingAmount: 0,
    balance: 40000,
    status: "PART_PAID",
    hasPending: false,
    inCredit: false,
    canLogPayment: true,
    optionalFees: [],
    payments: [],
    ...overrides,
  };
}

const BILL: BillView = {
  studentId: "s1",
  studentName: "Ada Obi",
  admissionNumber: "SCH/2026/0001",
  classId: "class-1",
  className: "Primary 3",
  levelId: "level-1",
  levelName: "Primary",
  sessionId: "session-1",
  sessionName: "2026/2027",
  termId: "term-1",
  termName: "First Term",
  termNumber: 1,
  billReference: "SCH/2026/0001-T1",
  billable: true,
  chargedLines: [{ feeId: "fee-1", feeName: "Tuition", amount: 50000 }],
  optionalLines: [],
  transportFares: [],
  total: 50000,
  currency: "NGN",
  bankAccounts: [],
  instructions: null,
  advance: false,
};

function renderPage() {
  resetAuthStore();
  useAuthStore.setState({
    user: {
      id: "guardian-1",
      email: "guardian@example.com",
      firstName: "Gina",
      lastName: "G",
      role: "GUARDIAN",
      schoolId: "school-1",
    },
    accessToken: "access",
    refreshToken: "refresh",
  });
  const router = createMemoryRouter([{ path: "/", element: <WardFeesPage /> }], { initialEntries: ["/"] });
  render(<RouterProvider router={router} />);
}

describe("WardFeesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetWardStore();
    resetFeatureStore();
    useFeatureStore.setState({ billing: true });
    vi.mocked(wardsApi.listMyWards).mockResolvedValue([WARD]);
    vi.mocked(wardsApi.getWardBill).mockResolvedValue(BILL);
    vi.mocked(feePaymentsApi.getWardFees).mockResolvedValue([term()]);
  });

  it("shows an empty state when the guardian has no linked wards", async () => {
    vi.mocked(wardsApi.listMyWards).mockResolvedValue([]);

    renderPage();

    expect(await screen.findByText("No wards linked yet")).toBeInTheDocument();
  });

  it("renders a term card's billed, paid and balance figures with its status badge", async () => {
    renderPage();

    const card = await screen.findByLabelText("First Term, 2026/2027");
    expect(within(card).getByText("Part-paid")).toBeInTheDocument();
    expect(within(card).getByText("₦50,000.00")).toBeInTheDocument();
    expect(within(card).getByText("₦10,000.00")).toBeInTheDocument();
    expect(within(card).getByText("₦40,000.00")).toBeInTheDocument();
    expect(within(card).getByRole("button", { name: "Log payment" })).toBeInTheDocument();
  });

  it("shows No bill for a term without a published bill, and hides View bill", async () => {
    vi.mocked(feePaymentsApi.getWardFees).mockResolvedValue([
      term({ published: false, billReference: null, billed: null, balance: null, status: "UNPAID" }),
    ]);

    renderPage();

    const card = await screen.findByLabelText("First Term, 2026/2027");
    expect(within(card).getAllByText("No bill")).toHaveLength(2);
    expect(within(card).queryByRole("button", { name: "View bill" })).not.toBeInTheDocument();
    expect(within(card).getByRole("button", { name: "Log payment" })).toBeInTheDocument();
  });

  it("shows an overpayment as a credit", async () => {
    vi.mocked(feePaymentsApi.getWardFees).mockResolvedValue([
      term({ confirmedPaid: 55000, balance: -5000, status: "PAID_IN_FULL", inCredit: true, canLogPayment: false }),
    ]);

    renderPage();

    const card = await screen.findByLabelText("First Term, 2026/2027");
    expect(within(card).getAllByText("Credit")).toHaveLength(2);
    expect(within(card).getByText("₦5,000.00")).toBeInTheDocument();
  });

  it("hides Log payment once the term is paid in full", async () => {
    vi.mocked(feePaymentsApi.getWardFees).mockResolvedValue([
      term({ confirmedPaid: 50000, balance: 0, status: "PAID_IN_FULL", canLogPayment: false }),
    ]);

    renderPage();

    const card = await screen.findByLabelText("First Term, 2026/2027");
    expect(within(card).getByText("Paid in full")).toBeInTheDocument();
    expect(within(card).queryByRole("button", { name: "Log payment" })).not.toBeInTheDocument();
  });

  it("hides Log payment when the school isn't entitled to billing", async () => {
    useFeatureStore.setState({ billing: false });

    renderPage();

    await screen.findByLabelText("First Term, 2026/2027");
    expect(screen.queryByRole("button", { name: "Log payment" })).not.toBeInTheDocument();
  });

  it("opens the log-payment sheet from Log payment", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Log payment" }));

    expect(await screen.findByRole("dialog", { name: "Log payment" })).toBeInTheDocument();
  });

  it("offers Edit and Withdraw only on a payment the guardian can still edit", async () => {
    vi.mocked(feePaymentsApi.getWardFees).mockResolvedValue([
      term({
        pendingAmount: 20000,
        hasPending: true,
        payments: [
          payment(),
          payment({ paymentId: "p2", allocationId: "a2", canEdit: false, submittedByMe: false }),
        ],
      }),
    ]);

    renderPage();

    await screen.findByText("₦20,000.00 pending confirmation");
    expect(screen.getAllByRole("button", { name: "Edit" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Withdraw" })).toHaveLength(1);
  });

  it("withdraws a pending payment after confirming, then refetches", async () => {
    vi.mocked(feePaymentsApi.getWardFees).mockResolvedValue([term({ payments: [payment()] })]);
    vi.mocked(feePaymentsApi.withdrawFeePayment).mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Withdraw" }));
    const dialog = await screen.findByRole("dialog", { name: "Withdraw payment" });
    await user.click(within(dialog).getByRole("button", { name: "Withdraw" }));

    await waitFor(() => expect(feePaymentsApi.withdrawFeePayment).toHaveBeenCalledWith("p1"));
    expect(await screen.findByText("Payment withdrawn.")).toBeInTheDocument();
    expect(feePaymentsApi.getWardFees).toHaveBeenCalledTimes(2);
  });

  it("shows a rejection's reason and offers Resubmit to its submitter", async () => {
    vi.mocked(feePaymentsApi.getWardFees).mockResolvedValue([
      term({
        payments: [payment({ status: "REJECTED", canEdit: false, reason: "Teller is unreadable" })],
      }),
    ]);
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText(/Teller is unreadable/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Resubmit" }));

    expect(await screen.findByRole("dialog", { name: "Resubmit payment" })).toBeInTheDocument();
  });

  it("downloads a confirmed payment's receipt", async () => {
    vi.mocked(feePaymentsApi.getWardFees).mockResolvedValue([
      term({
        payments: [
          payment({
            status: "CONFIRMED",
            canEdit: false,
            confirmedAmount: 10000,
            settlement: "PARTIAL",
            receipts: [
              { receiptId: "r1", receiptNumber: "RCT/2026/00001", status: "ISSUED", issuedAt: "2026-09-21T09:00:00Z" },
            ],
          }),
        ],
      }),
    ]);
    const blob = new Blob(["%PDF-"]);
    vi.mocked(feePaymentsApi.downloadFeeReceiptPdf).mockResolvedValue(blob);
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText("Confirmed · part payment")).toBeInTheDocument();
    expect(screen.getByText("You logged ₦20,000.00")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Receipt RCT\/2026\/00001/ }));

    await waitFor(() => expect(downloadBlob).toHaveBeenCalledWith(blob, "receipt-RCT-2026-00001.pdf"));
    expect(feePaymentsApi.downloadFeeReceiptPdf).toHaveBeenCalledWith("r1");
  });

  it("opens the bill from View bill and downloads its PDF", async () => {
    const blob = new Blob(["%PDF-"]);
    vi.mocked(wardsApi.downloadWardBillPdf).mockResolvedValue(blob);
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "View bill" }));
    const dialog = await screen.findByRole("dialog", { name: "First Term bill" });
    expect(within(dialog).getByText("Tuition")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: /Download PDF/ }));

    await waitFor(() => expect(downloadBlob).toHaveBeenCalledWith(blob, "SCH/2026/0001-bill-First Term.pdf"));
    expect(wardsApi.getWardBill).toHaveBeenCalledWith("s1", "term-1");
  });
});

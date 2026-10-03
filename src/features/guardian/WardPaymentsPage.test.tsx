import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/api/client";
import * as feePaymentsApi from "@/api/feePayments";
import type { WardFeePaymentView, WardFeeTermView } from "@/api/feePayments";
import * as wardsApi from "@/api/wards";
import { WardPaymentsPage } from "@/features/guardian/WardPaymentsPage";
import { resetAuthStore, useAuthStore } from "@/stores/authStore";
import { resetFeatureStore, useFeatureStore } from "@/stores/featureStore";
import { resetWardStore } from "@/stores/wardStore";
import { downloadBlob } from "@/utils/download";

vi.mock("@/api/wards", async () => {
  const actual = await vi.importActual<typeof import("@/api/wards")>("@/api/wards");
  return { ...actual, listMyWards: vi.fn() };
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

const ADA = {
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

const BEN = { ...ADA, studentId: "s2", fullName: "Ben Obi", admissionNumber: "SCH/2026/0002", gender: "MALE" as const };

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
    confirmedPaid: 0,
    pendingAmount: 0,
    balance: 50000,
    status: "UNPAID",
    hasPending: false,
    inCredit: false,
    canLogPayment: true,
    optionalFees: [],
    payments: [],
    ...overrides,
  };
}

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
  const router = createMemoryRouter([{ path: "/", element: <WardPaymentsPage /> }], { initialEntries: ["/"] });
  render(<RouterProvider router={router} />);
}

/** The table's body rows, top to bottom. */
function bodyRows() {
  const table = screen.getByRole("table", { name: "Payments" });
  return within(table).getAllByRole("row").slice(1);
}

describe("WardPaymentsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetWardStore();
    resetFeatureStore();
    useFeatureStore.setState({ billing: true });
    vi.mocked(wardsApi.listMyWards).mockResolvedValue([ADA, BEN]);
    vi.mocked(feePaymentsApi.getWardFees).mockImplementation((studentId) =>
      Promise.resolve(
        studentId === "s1"
          ? [
              term({ payments: [payment({ paymentDate: "2026-09-10" })] }),
              term({
                termId: "term-2",
                termName: "Second Term",
                payments: [
                  payment({
                    paymentId: "p3",
                    allocationId: "a3",
                    status: "REJECTED",
                    canEdit: false,
                    reason: "Teller is unreadable",
                    paymentDate: "2026-09-05",
                  }),
                ],
              }),
            ]
          : [term({ payments: [payment({ paymentId: "p2", allocationId: "a2", paymentDate: "2026-09-25", canEdit: false, submittedByMe: false })] })],
      ),
    );
  });

  it("merges every ward's payments into one table, newest first", async () => {
    renderPage();

    await screen.findByRole("table", { name: "Payments" });
    const rows = bodyRows();
    expect(rows).toHaveLength(3);
    expect(within(rows[0]).getByText("Ben Obi")).toBeInTheDocument();
    expect(within(rows[1]).getByText("Ada Obi")).toBeInTheDocument();
    expect(within(rows[1]).getByText("First Term")).toBeInTheDocument();
    expect(within(rows[2]).getByText("Second Term")).toBeInTheDocument();
    expect(feePaymentsApi.getWardFees).toHaveBeenCalledWith("s1");
    expect(feePaymentsApi.getWardFees).toHaveBeenCalledWith("s2");
  });

  it("filters by child and by status", async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByRole("table", { name: "Payments" });
    await user.selectOptions(screen.getByLabelText("Child"), "s2");
    expect(bodyRows()).toHaveLength(1);
    expect(within(bodyRows()[0]).getByText("Ben Obi")).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Child"), "");
    await user.selectOptions(screen.getByLabelText("Status"), "REJECTED");
    expect(bodyRows()).toHaveLength(1);
    expect(within(bodyRows()[0]).getByText("Second Term")).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Status"), "VOIDED");
    expect(screen.getByText("No payments match these filters.")).toBeInTheDocument();
  });

  it("pages the merged payments 20 at a time and resets to page 1 on a filter change", async () => {
    const user = userEvent.setup();
    const many = Array.from({ length: 25 }, (_, index) =>
      payment({
        paymentId: `p${index}`,
        allocationId: `a${index}`,
        paymentDate: `2026-09-${String(index + 1).padStart(2, "0")}`,
      }),
    );
    vi.mocked(feePaymentsApi.getWardFees).mockImplementation((studentId) =>
      Promise.resolve(studentId === "s1" ? [term({ payments: many })] : []),
    );
    renderPage();

    await screen.findByRole("table", { name: "Payments" });
    expect(bodyRows()).toHaveLength(20);
    expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Next page" }));
    expect(bodyRows()).toHaveLength(5);
    expect(screen.getByText("Page 2 of 2")).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Status"), "PENDING");
    expect(bodyRows()).toHaveLength(20);
    expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();
  });

  it("offers Edit and Withdraw only on a payment the guardian can still edit", async () => {
    renderPage();

    await screen.findByRole("table", { name: "Payments" });
    expect(screen.getAllByRole("button", { name: "Edit" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Withdraw" })).toHaveLength(1);
  });

  it("withdraws a pending payment after confirming, then refetches", async () => {
    vi.mocked(feePaymentsApi.withdrawFeePayment).mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Withdraw" }));
    const dialog = await screen.findByRole("dialog", { name: "Withdraw payment" });
    await user.click(within(dialog).getByRole("button", { name: "Withdraw" }));

    await waitFor(() => expect(feePaymentsApi.withdrawFeePayment).toHaveBeenCalledWith("p1"));
    expect(await screen.findByText("Payment withdrawn.")).toBeInTheDocument();
    await waitFor(() => expect(feePaymentsApi.getWardFees).toHaveBeenCalledTimes(4));
  });

  it("shows a rejection's reason and opens Resubmit for its submitter", async () => {
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByText(/Teller is unreadable/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Resubmit" }));

    expect(await screen.findByRole("dialog", { name: "Resubmit payment" })).toBeInTheDocument();
  });

  it("downloads a confirmed payment's receipt and shows an adjusted amount", async () => {
    vi.mocked(wardsApi.listMyWards).mockResolvedValue([ADA]);
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
    expect(screen.getByText("₦10,000.00")).toBeInTheDocument();
    expect(screen.getByText("You logged ₦20,000.00")).toBeInTheDocument();
    // A single ward needs no Child filter.
    expect(screen.queryByLabelText("Child")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Documents for Ada Obi/ }));
    await user.click(screen.getByRole("menuitem", { name: /Receipt RCT\/2026\/00001/ }));

    await waitFor(() => expect(downloadBlob).toHaveBeenCalledWith(blob, "receipt-RCT-2026-00001.pdf"));
    expect(feePaymentsApi.downloadFeeReceiptPdf).toHaveBeenCalledWith("r1");
  });

  it("downloads a payment's proof from the Documents menu", async () => {
    vi.mocked(wardsApi.listMyWards).mockResolvedValue([ADA]);
    vi.mocked(feePaymentsApi.getWardFees).mockResolvedValue([term({ payments: [payment()] })]);
    const blob = new Blob(["jpeg"]);
    vi.mocked(feePaymentsApi.downloadFeePaymentAttachment).mockResolvedValue(blob);
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: /Documents for Ada Obi/ }));
    await user.click(screen.getByRole("menuitem", { name: "Proof: teller.jpg" }));

    await waitFor(() => expect(downloadBlob).toHaveBeenCalledWith(blob, "teller.jpg"));
    expect(feePaymentsApi.downloadFeePaymentAttachment).toHaveBeenCalledWith("p1", "f1");
  });

  it("still lists the other wards' payments when one ward's fetch fails", async () => {
    vi.mocked(feePaymentsApi.getWardFees).mockImplementation((studentId) =>
      studentId === "s1"
        ? Promise.reject(new ApiError(403, "Feature not included"))
        : Promise.resolve([term({ payments: [payment({ paymentId: "p2", allocationId: "a2" })] })]),
    );

    renderPage();

    expect(await screen.findByText("Couldn't load payments for Ada Obi.")).toBeInTheDocument();
    expect(bodyRows()).toHaveLength(1);
    expect(within(bodyRows()[0]).getByText("Ben Obi")).toBeInTheDocument();
  });

  it("shows an empty state when no payments have been logged", async () => {
    vi.mocked(feePaymentsApi.getWardFees).mockResolvedValue([term()]);

    renderPage();

    expect(await screen.findByText("No payments yet")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("opens the log-payment sheet from Log payment", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Log payment" }));

    expect(await screen.findByRole("dialog", { name: "Log payment" })).toBeInTheDocument();
  });
});

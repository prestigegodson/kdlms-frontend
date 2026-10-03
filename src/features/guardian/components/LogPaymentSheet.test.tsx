import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as feePaymentsApi from "@/api/feePayments";
import type { FeePaymentView, WardFeePaymentView, WardFeeTermView } from "@/api/feePayments";
import type { MyWardView } from "@/api/wards";
import { LogPaymentSheet, type LogPaymentIntent } from "@/features/guardian/components/LogPaymentSheet";
import { resetAuthStore, useAuthStore } from "@/stores/authStore";

vi.mock("@/api/feePayments", async () => {
  const actual = await vi.importActual<typeof import("@/api/feePayments")>("@/api/feePayments");
  return { ...actual, getWardFees: vi.fn(), submitFeePayment: vi.fn(), editFeePayment: vi.fn() };
});

vi.mock("@/utils/compressImage", async () => {
  const actual = await vi.importActual<typeof import("@/utils/compressImage")>("@/utils/compressImage");
  return {
    ...actual,
    compressImage: vi.fn((file: File) =>
      Promise.resolve(new File(["jpeg"], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" })),
    ),
  };
});

function ward(studentId: string, fullName: string, schoolId = "school-1"): MyWardView {
  return {
    studentId,
    fullName,
    admissionNumber: `ADM-${studentId}`,
    relationship: "MOTHER",
    gender: "FEMALE",
    status: "ACTIVE",
    schoolId,
    schoolName: schoolId === "school-1" ? "Bright Star Academy" : "Hilltop College",
  };
}

const ADA = ward("s1", "Ada Obi");
const BEN = ward("s2", "Ben Obi");
const CHI = ward("s3", "Chi Obi");
const DAN = ward("s4", "Dan Obi", "school-2");

function payment(overrides: Partial<WardFeePaymentView> = {}): WardFeePaymentView {
  return {
    paymentId: "p1",
    allocationId: "a1",
    status: "PENDING",
    claimedAmount: 20000,
    confirmedAmount: null,
    settlement: null,
    reason: null,
    paymentDate: "2020-01-15",
    method: "BANK_DEPOSIT",
    payerName: "Gina G",
    note: "Teller 123",
    totalAmount: 30000,
    childCount: 2,
    submittedAt: "2020-01-15T10:00:00Z",
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
    billReference: "REF",
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

const SAVED: FeePaymentView = {
  id: "p-new",
  termId: "term-1",
  payerName: "Gina G",
  paymentDate: "2020-01-15",
  method: "BANK_TRANSFER",
  note: null,
  totalAmount: 1,
  currency: "NGN",
  status: "PENDING",
  attachmentFileIds: [],
  allocations: [],
};

let siblingTerms: Record<string, WardFeeTermView[]>;

function renderSheet(intent: LogPaymentIntent, wards: MyWardView[] = [ADA, BEN, CHI, DAN]) {
  const onSubmitted = vi.fn();
  render(<LogPaymentSheet intent={intent} wards={wards} onClose={vi.fn()} onSubmitted={onSubmitted} />);
  return { onSubmitted };
}

async function attachProof(user: ReturnType<typeof userEvent.setup>) {
  await user.upload(screen.getByTestId("proof-file-input"), new File(["png"], "slip.png", { type: "image/png" }));
  await screen.findByRole("button", { name: "Remove slip.jpg" });
}

describe("LogPaymentSheet", () => {
  beforeEach(() => {
    resetAuthStore();
    useAuthStore.setState({
      user: { id: "guardian-1", email: "g@example.com", firstName: "Gina", lastName: "G", role: "GUARDIAN" },
      accessToken: "access",
      refreshToken: "refresh",
    });
    siblingTerms = {
      s2: [term({ balance: 30000 })],
      s3: [term({ balance: 0, status: "PAID_IN_FULL", canLogPayment: false })],
    };
    vi.mocked(feePaymentsApi.getWardFees).mockImplementation((studentId) =>
      Promise.resolve(siblingTerms[studentId] ?? []),
    );
    vi.mocked(feePaymentsApi.submitFeePayment).mockResolvedValue(SAVED);
    vi.mocked(feePaymentsApi.editFeePayment).mockResolvedValue(SAVED);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("sends the per-child amounts with a total that is exactly their sum", async () => {
    const user = userEvent.setup();
    const { onSubmitted } = renderSheet({ kind: "new", studentId: "s1", term: term() });

    const adaAmount = await screen.findByLabelText("Amount for Ada Obi");
    expect(adaAmount).toHaveValue("40000");
    await user.click(screen.getByRole("checkbox", { name: /Ben Obi/ }));
    expect(screen.getByLabelText("Amount for Ben Obi")).toHaveValue("30000");

    await user.clear(adaAmount);
    await user.type(adaAmount, "15,000.10");
    expect(screen.getByTestId("payment-total")).toHaveTextContent("45,000.10");

    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText(/Step 2 of 3/)).toBeInTheDocument();
    expect(screen.getByLabelText("Payer name")).toHaveValue("Gina G");
    await user.click(screen.getByRole("radio", { name: "Bank transfer" }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    await attachProof(user);
    await user.click(screen.getByRole("button", { name: "Submit payment" }));

    await waitFor(() => expect(onSubmitted).toHaveBeenCalled());
    const [request, files] = vi.mocked(feePaymentsApi.submitFeePayment).mock.calls[0];
    expect(request.totalAmount).toBe(45000.1);
    expect(request.children).toEqual([
      { studentId: "s1", amount: 15000.1, optionalFeeIds: [] },
      { studentId: "s2", amount: 30000, optionalFeeIds: [] },
    ]);
    expect(request.method).toBe("BANK_TRANSFER");
    expect(files.map((file) => file.name)).toEqual(["slip.jpg"]);
  });

  it("disables a paid-in-full sibling and a ward at another school", async () => {
    renderSheet({ kind: "new", studentId: "s1", term: term() });

    const chi = await screen.findByRole("checkbox", { name: /Chi Obi/ });
    expect(chi).toBeDisabled();
    expect(screen.getByText("Paid in full")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /Dan Obi/ })).toBeDisabled();
    expect(screen.getByText("Different school — log separately")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /Ben Obi/ })).toBeEnabled();
    // Only the same school's siblings are fetched.
    expect(feePaymentsApi.getWardFees).not.toHaveBeenCalledWith("s4");
  });

  it("warns on overpayment without blocking it", async () => {
    const user = userEvent.setup();
    renderSheet({ kind: "new", studentId: "s1", term: term() }, [ADA]);

    const amount = await screen.findByLabelText("Amount for Ada Obi");
    await user.clear(amount);
    await user.type(amount, "50000");
    expect(screen.getByText(/the extra will show as a credit/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeEnabled();
  });

  it("skips the optional-fees step when no ticked child has one", async () => {
    renderSheet({ kind: "new", studentId: "s1", term: term() }, [ADA]);
    expect(await screen.findByText(/Step 1 of 3 · Children & amounts/)).toBeInTheDocument();
  });

  it("shows the optional-fees step and sends the ticked fees", async () => {
    const user = userEvent.setup();
    const withFee = term({ optionalFees: [{ feeId: "fee-x", feeName: "Excursion", amount: 5000 }] });
    renderSheet({ kind: "new", studentId: "s1", term: withFee }, [ADA]);

    expect(await screen.findByText(/Step 1 of 4/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText(/Step 2 of 4 · Optional fees/)).toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: /Excursion/ }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("radio", { name: "Cash" }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    await attachProof(user);
    expect(screen.getByText("Includes Excursion")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Submit payment" }));

    await waitFor(() => expect(feePaymentsApi.submitFeePayment).toHaveBeenCalled());
    expect(vi.mocked(feePaymentsApi.submitFeePayment).mock.calls[0][0].children[0].optionalFeeIds).toEqual(["fee-x"]);
  });

  it("requires a guardian to attach proof before submitting", async () => {
    const user = userEvent.setup();
    renderSheet({ kind: "new", studentId: "s1", term: term() }, [ADA]);

    await user.click(await screen.findByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("radio", { name: "POS" }));
    await user.click(screen.getByRole("button", { name: "Next" }));

    expect(screen.getByRole("button", { name: "Submit payment" })).toBeDisabled();
    await attachProof(user);
    expect(screen.getByRole("button", { name: "Submit payment" })).toBeEnabled();
  });

  it("prefills an edit from every child on the payment and keeps its attachments", async () => {
    const user = userEvent.setup();
    const adaPayment = payment();
    siblingTerms.s2 = [
      term({ balance: 30000, pendingAmount: 10000, payments: [payment({ allocationId: "a2", claimedAmount: 10000 })] }),
    ];
    const { onSubmitted } = renderSheet({
      kind: "edit",
      studentId: "s1",
      term: term({ pendingAmount: 20000, payments: [adaPayment] }),
      payment: adaPayment,
    });

    expect(await screen.findByLabelText("Amount for Ada Obi")).toHaveValue("20000");
    expect(screen.getByLabelText("Amount for Ben Obi")).toHaveValue("10000");
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByLabelText("Note (optional)")).toHaveValue("Teller 123");
    expect(screen.getByRole("radio", { name: "Bank deposit" })).toBeChecked();
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("button", { name: "Remove teller.jpg" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(onSubmitted).toHaveBeenCalledWith("Payment updated."));
    const [paymentId, request, files] = vi.mocked(feePaymentsApi.editFeePayment).mock.calls[0];
    expect(paymentId).toBe("p1");
    expect(request.keepAttachmentFileIds).toEqual(["f1"]);
    expect(request.totalAmount).toBe(30000);
    expect(request.children.map((child) => child.studentId)).toEqual(["s1", "s2"]);
    expect(files).toEqual([]);
  });

  it("keeps everything entered when a submit fails, so Submit can retry", async () => {
    const user = userEvent.setup();
    vi.mocked(feePaymentsApi.submitFeePayment)
      .mockRejectedValueOnce(new Error("Network request failed"))
      .mockResolvedValueOnce(SAVED);
    const { onSubmitted } = renderSheet({ kind: "new", studentId: "s1", term: term() }, [ADA]);

    await user.click(await screen.findByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("radio", { name: "Cheque" }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    await attachProof(user);
    await user.click(screen.getByRole("button", { name: "Submit payment" }));

    expect(await screen.findByText(/Couldn't send your payment/)).toBeInTheDocument();
    expect(onSubmitted).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Remove slip.jpg" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Submit payment" }));
    await waitFor(() => expect(onSubmitted).toHaveBeenCalledWith("Payment logged — the school will confirm it."));
    const [first, second] = vi.mocked(feePaymentsApi.submitFeePayment).mock.calls;
    expect(second[0]).toEqual(first[0]);
    expect(second[1]).toEqual(first[1]);
  });

  describe("from the Fees page (no ward picked)", () => {
    const SECOND_TERM = { termId: "term-2", termName: "Second Term", termNumber: 2 };

    it("skips the school step for a single school and defaults to the current term", async () => {
      const user = userEvent.setup();
      siblingTerms = {
        s1: [term({ ...SECOND_TERM, current: false, balance: 60000 }), term({ balance: 40000 })],
        s2: [term({ balance: 30000 })],
      };
      const { onSubmitted } = renderSheet({ kind: "open" }, [ADA, BEN]);

      expect(await screen.findByText(/Step 1 of 4 · Term/)).toBeInTheDocument();
      const termSelect = screen.getByLabelText("Which term is this payment for?");
      expect(termSelect).toHaveValue("term-1");
      expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
        "Second Term, 2026/2027",
        "First Term, 2026/2027 (current)",
      ]);
      await user.click(screen.getByRole("button", { name: "Next" }));

      // Two tickable children - neither is ticked for the guardian.
      expect(screen.getByRole("checkbox", { name: /Ada Obi/ })).not.toBeChecked();
      expect(screen.getByRole("checkbox", { name: /Ben Obi/ })).not.toBeChecked();
      expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
      await user.click(screen.getByRole("checkbox", { name: /Ada Obi/ }));
      await user.click(screen.getByRole("checkbox", { name: /Ben Obi/ }));
      expect(screen.getByLabelText("Amount for Ada Obi")).toHaveValue("40000");

      await user.click(screen.getByRole("button", { name: "Next" }));
      await user.click(screen.getByRole("radio", { name: "Cash" }));
      await user.click(screen.getByRole("button", { name: "Next" }));
      await attachProof(user);
      await user.click(screen.getByRole("button", { name: "Submit payment" }));

      await waitFor(() => expect(onSubmitted).toHaveBeenCalled());
      const [request] = vi.mocked(feePaymentsApi.submitFeePayment).mock.calls[0];
      expect(request.termId).toBe("term-1");
      expect(request.totalAmount).toBe(70000);
      expect(request.children.map((child) => child.studentId)).toEqual(["s1", "s2"]);
    });

    it("asks for the school first and lists only that school's wards", async () => {
      const user = userEvent.setup();
      siblingTerms = { s1: [term()], s2: [term({ balance: 30000 })], s4: [term({ balance: 25000 })] };
      renderSheet({ kind: "open" }, [ADA, BEN, DAN]);

      expect(await screen.findByText(/Step 1 of 5 · School/)).toBeInTheDocument();
      expect(screen.getByText("Ada Obi, Ben Obi")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
      expect(feePaymentsApi.getWardFees).not.toHaveBeenCalled();

      await user.click(screen.getByRole("radio", { name: /Hilltop College/ }));
      await user.click(screen.getByRole("button", { name: "Next" }));
      expect(await screen.findByText(/Step 2 of 5 · Term/)).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Next" }));

      // The only tickable child is ticked for the guardian; other schools' wards aren't shown.
      expect(screen.getByRole("checkbox", { name: /Dan Obi/ })).toBeChecked();
      expect(screen.getByLabelText("Amount for Dan Obi")).toHaveValue("25000");
      expect(screen.queryByRole("checkbox", { name: /Ada Obi/ })).not.toBeInTheDocument();
      expect(screen.queryByText("Different school — log separately")).not.toBeInTheDocument();
      expect(feePaymentsApi.getWardFees).toHaveBeenCalledTimes(1);
      expect(feePaymentsApi.getWardFees).toHaveBeenCalledWith("s4");
    });

    it("offers only terms someone can still pay, and says so when there are none", async () => {
      siblingTerms = {
        s1: [term({ status: "PAID_IN_FULL", balance: 0, canLogPayment: false })],
        s2: [term({ status: "PAID_IN_FULL", balance: 0, canLogPayment: false })],
      };
      renderSheet({ kind: "open" }, [ADA, BEN]);

      expect(
        await screen.findByText(/Nothing to pay at Bright Star Academy right now/),
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    });

    it("starts the children over when the term changes", async () => {
      const user = userEvent.setup();
      siblingTerms = {
        s1: [term({ ...SECOND_TERM, current: false, balance: 60000 }), term({ balance: 40000 })],
      };
      renderSheet({ kind: "open" }, [ADA]);

      await user.click(await screen.findByRole("button", { name: "Next" }));
      const amount = screen.getByLabelText("Amount for Ada Obi");
      expect(amount).toHaveValue("40000");
      await user.clear(amount);
      await user.type(amount, "100");

      await user.click(screen.getByRole("button", { name: "Back" }));
      await user.selectOptions(screen.getByLabelText("Which term is this payment for?"), "term-2");
      await user.click(screen.getByRole("button", { name: "Next" }));
      expect(screen.getByText("Second Term, 2026/2027")).toBeInTheDocument();
      expect(screen.getByLabelText("Amount for Ada Obi")).toHaveValue("60000");
    });
  });
});

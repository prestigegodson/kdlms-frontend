import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as billingApi from "@/api/billing";
import type { BillView } from "@/api/billing";
import * as api from "@/api/staffFeePayments";
import * as studentsApi from "@/api/students";
import type { StudentView } from "@/api/students";
import { RecordPaymentModal } from "@/features/billing/components/payments/RecordPaymentModal";
import {
  ledger,
  paymentView,
  termStatus,
} from "@/features/billing/components/payments/testFixtures";
import { resetAuthStore, useAuthStore } from "@/stores/authStore";
import { resetPendingFeePaymentsStore } from "@/stores/pendingFeePaymentsStore";

vi.mock("@/api/staffFeePayments", async () => {
  const actual =
    await vi.importActual<typeof import("@/api/staffFeePayments")>("@/api/staffFeePayments");
  return {
    ...actual,
    getStudentPaymentLedger: vi.fn(),
    recordFeePayment: vi.fn(),
    getPendingPaymentCount: vi.fn(),
  };
});

vi.mock("@/api/billing", async () => {
  const actual = await vi.importActual<typeof import("@/api/billing")>("@/api/billing");
  return { ...actual, getStudentBill: vi.fn() };
});

vi.mock("@/api/students", async () => {
  const actual = await vi.importActual<typeof import("@/api/students")>("@/api/students");
  return { ...actual, quickSearchStudents: vi.fn() };
});

const BEN: StudentView = {
  id: "student-2",
  schoolId: "school-1",
  branchId: "branch-1",
  admissionNumber: "SCH/2026/0002",
  firstName: "Ben",
  lastName: "Obi",
  fullName: "Ben Obi",
  gender: "MALE",
  admissionDate: "2020-09-01",
  status: "ACTIVE",
};

const BILL = {
  studentName: "Ada Obi",
  optionalLines: [{ feeId: "fee-x", feeName: "Excursion", amount: 5000 }],
} as unknown as BillView;

function ledgerWith(status: Parameters<typeof termStatus>[0], studentId = "student-1") {
  const base = ledger();
  return {
    ...base,
    studentId,
    terms: [{ ...base.terms[0], status: termStatus(status), payments: [] }],
  };
}

function renderModal(
  student = { id: "student-1", name: "Ada Obi", admissionNumber: "SCH/2026/0001" },
) {
  const onRecorded = vi.fn();
  render(
    <RecordPaymentModal
      target={{
        termId: "term-1",
        termLabel: "First Term",
        currency: "NGN",
        branchId: "branch-1",
        student,
      }}
      onClose={vi.fn()}
      onRecorded={onRecorded}
    />,
  );
  return onRecorded;
}

async function fillDetails(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Payer name"), "Gina Obi");
  await user.click(screen.getByRole("radio", { name: "Cash" }));
  await user.click(screen.getByRole("button", { name: "Next" }));
}

describe("RecordPaymentModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAuthStore();
    resetPendingFeePaymentsStore();
    useAuthStore.setState({
      user: {
        id: "user-1",
        email: "admin@school.example",
        firstName: "A",
        lastName: "B",
        role: "BRANCH_ADMIN",
        schoolId: "school-1",
        branchId: "branch-1",
      },
      accessToken: "access",
      refreshToken: "refresh",
    });
    vi.mocked(api.getPendingPaymentCount).mockResolvedValue({ count: 0 });
    vi.mocked(api.recordFeePayment).mockResolvedValue(paymentView());
    vi.mocked(billingApi.getStudentBill).mockResolvedValue(BILL);
    vi.mocked(api.getStudentPaymentLedger).mockResolvedValue(
      ledgerWith({
        state: "PART_PAID",
        confirmedPaid: 20000,
        pendingAmount: 0,
        balance: 30000,
        hasPending: false,
      }),
    );
  });

  it("saves as pending without proof, with the amount prefilled from the balance", async () => {
    const user = userEvent.setup();
    const onRecorded = renderModal();

    expect(await screen.findByLabelText("Amount for Ada Obi")).toHaveValue("30000");
    await user.click(screen.getByRole("button", { name: "Next" }));
    // Ada's bill has an unselected optional fee, so that step is shown - skip it.
    expect(screen.getByText(/Optional fees/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Next" }));
    await fillDetails(user);

    await user.click(screen.getByRole("button", { name: "Save as pending" }));

    expect(api.recordFeePayment).toHaveBeenCalledWith(
      {
        termId: "term-1",
        payerName: "Gina Obi",
        paymentDate: expect.any(String),
        method: "CASH",
        note: null,
        totalAmount: 30000,
        confirmNow: false,
        children: [{ studentId: "student-1", amount: 30000, optionalFeeIds: [], settlement: null }],
      },
      [],
      undefined,
    );
    expect(onRecorded).toHaveBeenCalledWith("Payment saved as pending.");
  });

  it("records and confirms several students with a settlement each", async () => {
    const user = userEvent.setup();
    vi.mocked(studentsApi.quickSearchStudents).mockResolvedValue([BEN]);
    vi.mocked(api.getStudentPaymentLedger).mockImplementation(async (studentId) =>
      studentId === "student-2"
        ? ledgerWith(
            {
              state: "UNPAID",
              billed: null,
              confirmedPaid: 0,
              pendingAmount: 0,
              balance: null,
              hasPending: false,
            },
            "student-2",
          )
        : ledgerWith({
            state: "PART_PAID",
            confirmedPaid: 20000,
            pendingAmount: 0,
            balance: 30000,
            hasPending: false,
          }),
    );
    vi.mocked(billingApi.getStudentBill).mockImplementation(async (studentId) => {
      if (studentId === "student-2") throw new Error("404");
      return BILL;
    });
    const onRecorded = renderModal();

    await screen.findByLabelText("Amount for Ada Obi");
    await user.type(screen.getByLabelText("Add a student"), "Ben");
    await user.click(await screen.findByRole("option", { name: /Ben Obi/ }));
    const benAmount = await screen.findByLabelText("Amount for Ben Obi");
    expect(screen.getByText("No bill this term - enter the amount received")).toBeInTheDocument();
    await user.type(benAmount, "5000");
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("checkbox", { name: /Excursion/ }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    await fillDetails(user);

    await user.click(screen.getByRole("button", { name: "Record & confirm" }));

    expect(api.recordFeePayment).toHaveBeenCalledWith(
      expect.objectContaining({
        confirmNow: true,
        totalAmount: 35000,
        children: [
          // 20,000 + 30,000 covers the 50,000 bill, but the ticked excursion raises it to 55,000.
          {
            studentId: "student-1",
            amount: 30000,
            optionalFeeIds: ["fee-x"],
            settlement: "PARTIAL",
          },
          { studentId: "student-2", amount: 5000, optionalFeeIds: [], settlement: "PARTIAL" },
        ],
      }),
      [],
      undefined,
    );
    expect(onRecorded).toHaveBeenCalledWith("Payment recorded and confirmed - receipts issued.");
  });

  it("allows a paid-in-full student with a warning rather than refusing them", async () => {
    vi.mocked(api.getStudentPaymentLedger).mockResolvedValue(
      ledgerWith({
        state: "PAID_IN_FULL",
        confirmedPaid: 50000,
        pendingAmount: 0,
        balance: 0,
        hasPending: false,
      }),
    );
    renderModal();

    expect(await screen.findByText(/Already paid in full for this term/)).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /Ada Obi/ })).toBeEnabled();
    expect(screen.getByRole("checkbox", { name: /Ada Obi/ })).toBeChecked();
  });
});

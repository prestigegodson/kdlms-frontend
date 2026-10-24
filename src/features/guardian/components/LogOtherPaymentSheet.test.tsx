import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as feePaymentsApi from "@/api/feePayments";
import type { FeePaymentView, OtherPaymentItemView } from "@/api/feePayments";
import type { MyWardView } from "@/api/wards";
import {
  LogOtherPaymentSheet,
  type LogOtherPaymentIntent,
} from "@/features/guardian/components/LogOtherPaymentSheet";
import { resetAuthStore, useAuthStore } from "@/stores/authStore";

vi.mock("@/api/feePayments", async () => {
  const actual = await vi.importActual<typeof import("@/api/feePayments")>("@/api/feePayments");
  return {
    ...actual,
    getWardOtherPaymentItems: vi.fn(),
    submitFeePayment: vi.fn(),
    editFeePayment: vi.fn(),
  };
});

vi.mock("@/utils/compressImage", async () => {
  const actual =
    await vi.importActual<typeof import("@/utils/compressImage")>("@/utils/compressImage");
  return {
    ...actual,
    compressImage: vi.fn((file: File) =>
      Promise.resolve(
        new File(["jpeg"], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" }),
      ),
    ),
  };
});

function ward(studentId: string, fullName: string): MyWardView {
  return {
    studentId,
    fullName,
    admissionNumber: `ADM-${studentId}`,
    relationship: "MOTHER",
    gender: "FEMALE",
    status: "ACTIVE",
    schoolId: "school-1",
    schoolName: "Bright Star Academy",
  };
}

const ADA = ward("s1", "Ada Obi");
const BEN = ward("s2", "Ben Obi");

const PARTY: OtherPaymentItemView = {
  id: "item-1",
  name: "Christmas party",
  amount: 5000,
  active: true,
  position: 0,
  createdAt: "2026-10-01T00:00:00Z",
  updatedAt: "2026-10-01T00:00:00Z",
};

const SAVED: FeePaymentView = {
  id: "p-new",
  termId: "term-1",
  payerName: "Gina G",
  paymentDate: "2020-01-15",
  method: "CASH",
  note: null,
  totalAmount: 1,
  currency: "NGN",
  status: "PENDING",
  attachmentFileIds: [],
  allocations: [],
  purpose: "OTHER",
  purposeLabel: "Christmas party",
};

function renderSheet(intent: LogOtherPaymentIntent) {
  const onSubmitted = vi.fn();
  render(
    <LogOtherPaymentSheet
      intent={intent}
      wards={[ADA, BEN]}
      paymentsByStudent={new Map()}
      currencyBySchool={new Map([["school-1", "NGN"]])}
      onClose={vi.fn()}
      onSubmitted={onSubmitted}
    />,
  );
  return { onSubmitted };
}

async function detailsAndProof(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Next" }));
  await user.click(screen.getByRole("radio", { name: "Cash" }));
  await user.click(screen.getByRole("button", { name: "Next" }));
  await user.upload(
    screen.getByTestId("proof-file-input"),
    new File(["png"], "slip.png", { type: "image/png" }),
  );
  await screen.findByRole("button", { name: "Remove slip.jpg" });
}

describe("LogOtherPaymentSheet", () => {
  beforeEach(() => {
    resetAuthStore();
    useAuthStore.setState({
      user: {
        id: "guardian-1",
        email: "g@example.com",
        firstName: "Gina",
        lastName: "G",
        role: "GUARDIAN",
      },
      accessToken: "access",
      refreshToken: "refresh",
    });
    vi.mocked(feePaymentsApi.getWardOtherPaymentItems).mockResolvedValue([PARTY]);
    vi.mocked(feePaymentsApi.submitFeePayment).mockResolvedValue(SAVED);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("logs a payment against a school item, prefilling its suggested amount per child", async () => {
    const user = userEvent.setup();
    const { onSubmitted } = renderSheet({ kind: "new" });

    await user.click(await screen.findByRole("radio", { name: /Christmas party/ }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("checkbox", { name: /Ada Obi/ }));
    await user.click(screen.getByRole("checkbox", { name: /Ben Obi/ }));
    expect(screen.getByLabelText("Amount for Ada Obi")).toHaveValue("5000");
    expect(screen.getByLabelText("Amount for Ben Obi")).toHaveValue("5000");
    await detailsAndProof(user);
    await user.click(screen.getByRole("button", { name: "Submit payment" }));

    await waitFor(() => expect(onSubmitted).toHaveBeenCalled());
    const [request] = vi.mocked(feePaymentsApi.submitFeePayment).mock.calls[0];
    expect(request).toMatchObject({
      termId: null,
      purpose: "OTHER",
      otherItemId: "item-1",
      purposeLabel: null,
      totalAmount: 10000,
      method: "CASH",
    });
    expect(request.children).toEqual([
      { studentId: "s1", amount: 5000, optionalFeeIds: [] },
      { studentId: "s2", amount: 5000, optionalFeeIds: [] },
    ]);
  });

  it("logs a payment for something else under the guardian's own label", async () => {
    const user = userEvent.setup();
    renderSheet({ kind: "new" });

    await user.click(await screen.findByRole("radio", { name: "Something else" }));
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    await user.type(screen.getByLabelText("Describe what you paid for"), "Excursion to the zoo");
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("checkbox", { name: /Ada Obi/ }));
    await user.type(screen.getByLabelText("Amount for Ada Obi"), "2500");
    await detailsAndProof(user);
    expect(screen.getByLabelText("Payment summary")).toHaveTextContent("Excursion to the zoo");
    await user.click(screen.getByRole("button", { name: "Submit payment" }));

    await waitFor(() => expect(feePaymentsApi.submitFeePayment).toHaveBeenCalled());
    const [request] = vi.mocked(feePaymentsApi.submitFeePayment).mock.calls[0];
    expect(request).toMatchObject({
      otherItemId: null,
      purposeLabel: "Excursion to the zoo",
      totalAmount: 2500,
    });
  });
});

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as billingApi from "@/api/billing";
import type { StudentBillAdjustmentsView } from "@/api/billing";
import { StudentBillAdjustmentsModal } from "@/features/billing/components/StudentBillAdjustmentsModal";

vi.mock("@/api/billing", async () => {
  const actual = await vi.importActual<typeof import("@/api/billing")>("@/api/billing");
  return { ...actual, saveStudentBillAdjustments: vi.fn() };
});

const VIEW: StudentBillAdjustmentsView = {
  studentId: "student-1",
  studentName: "Ada Obi",
  admissionNumber: "SCH/2026/0001",
  classId: "class-1",
  className: "Primary 1A",
  levelId: "level-1",
  levelName: "Primary",
  termId: "term-1",
  termName: "First Term",
  termNumber: 1,
  sessionId: "session-1",
  sessionName: "2026/2027",
  currency: "NGN",
  billable: true,
  published: false,
  advance: false,
  fees: [
    {
      feeId: "fee-1",
      feeName: "Tuition",
      compulsory: true,
      applicableThisTerm: true,
      standardAmount: 5000,
      selected: false,
      overrideAmount: null,
      thisTermOnly: false,
      effectiveAmount: 5000,
    },
    {
      feeId: "fee-2",
      feeName: "Excursion",
      compulsory: false,
      applicableThisTerm: true,
      standardAmount: 2000,
      selected: false,
      overrideAmount: null,
      thisTermOnly: false,
      effectiveAmount: null,
    },
  ],
  extras: [],
  transport: {
    assignable: true,
    unassignableReason: null,
    routeId: null,
    direction: null,
    amount: null,
    routes: [{ routeId: "route-1", routeName: "Ikeja", oneWayAmount: 5000, toAndFroAmount: 9000 }],
  },
};

function renderModal(overrides: Partial<StudentBillAdjustmentsView> = {}) {
  const onClose = vi.fn();
  const onSaved = vi.fn();
  render(
    <StudentBillAdjustmentsModal
      studentId="student-1"
      termId="term-1"
      view={{ ...VIEW, ...overrides }}
      onClose={onClose}
      onSaved={onSaved}
    />,
  );
  return { onClose, onSaved };
}

describe("StudentBillAdjustmentsModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders every fee row with its standard amount and a checkbox only for optional fees", () => {
    renderModal();

    expect(screen.getByText("Tuition")).toBeInTheDocument();
    expect(screen.getByText("Excursion")).toBeInTheDocument();
    expect(screen.getByLabelText("Charge Excursion")).toBeInTheDocument();
    expect(screen.queryByLabelText("Charge Tuition")).not.toBeInTheDocument();
  });

  it("shows a published-bill warning when the branch+term is already published", () => {
    renderModal({ published: true });

    expect(screen.getByText("This term's bills are already published")).toBeInTheDocument();
  });

  it("shows an advance-bill note naming the billing level and session when the view is an advance bill", () => {
    renderModal({ advance: true, levelName: "Junior Secondary", sessionName: "2027/2028" });

    expect(screen.getByText("Advance bill")).toBeInTheDocument();
    expect(screen.getByText(/2027\/2028/)).toBeInTheDocument();
    expect(screen.getByText(/Junior Secondary/)).toBeInTheDocument();
  });

  it("shows no advance-bill note for an ordinary bill", () => {
    renderModal();

    expect(screen.queryByText("Advance bill")).not.toBeInTheDocument();
  });

  it("selecting an optional fee and saving submits it as a standing selection", async () => {
    vi.mocked(billingApi.saveStudentBillAdjustments).mockResolvedValue(VIEW);
    const user = userEvent.setup();
    const { onSaved, onClose } = renderModal();

    await user.click(screen.getByLabelText("Charge Excursion"));
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(billingApi.saveStudentBillAdjustments).toHaveBeenCalled());
    const [, , fees, extras, transportRouteId, transportDirection] = vi.mocked(billingApi.saveStudentBillAdjustments)
      .mock.calls[0];
    expect(fees).toEqual([{ feeId: "fee-2", selected: true, overrideAmount: null, thisTermOnly: false }]);
    expect(extras).toEqual([]);
    expect(transportRouteId).toBeNull();
    expect(transportDirection).toBeNull();
    expect(onSaved).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("typing an override amount on a compulsory fee saves it even though the fee has no checkbox", async () => {
    vi.mocked(billingApi.saveStudentBillAdjustments).mockResolvedValue(VIEW);
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByLabelText("Override amount for Tuition"), "4500");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(billingApi.saveStudentBillAdjustments).toHaveBeenCalled());
    const [, , fees] = vi.mocked(billingApi.saveStudentBillAdjustments).mock.calls[0];
    expect(fees).toContainEqual({ feeId: "fee-1", selected: false, overrideAmount: 4500, thisTermOnly: false });
  });

  it("adding a custom charge and saving submits it with its own scope", async () => {
    vi.mocked(billingApi.saveStudentBillAdjustments).mockResolvedValue(VIEW);
    const user = userEvent.setup();
    renderModal();

    await user.click(screen.getByRole("button", { name: "Add charge" }));
    await user.type(screen.getByLabelText("Label"), "Damaged locker");
    await user.type(screen.getByLabelText("Amount"), "300");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(billingApi.saveStudentBillAdjustments).toHaveBeenCalled());
    const [, , , extras] = vi.mocked(billingApi.saveStudentBillAdjustments).mock.calls[0];
    expect(extras).toEqual([{ label: "Damaged locker", amount: 300, thisTermOnly: true }]);
  });

  it("rejects a negative override amount without calling save", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByLabelText("Override amount for Tuition"), "-1");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText(/enter a number 0 or greater/)).toBeInTheDocument();
    expect(billingApi.saveStudentBillAdjustments).not.toHaveBeenCalled();
  });

  it("a save failure keeps the modal open with the error shown", async () => {
    vi.mocked(billingApi.saveStudentBillAdjustments).mockRejectedValue(new Error("boom"));
    const user = userEvent.setup();
    const { onClose } = renderModal();

    await user.click(screen.getByLabelText("Charge Excursion"));
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Failed to save bill adjustments")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  // ---- Phase 26: school-bus assignment ----

  it("assigning a route and direction folds the fare into the total and submits it", async () => {
    vi.mocked(billingApi.saveStudentBillAdjustments).mockResolvedValue(VIEW);
    const user = userEvent.setup();
    renderModal();

    await user.selectOptions(screen.getByLabelText("Route"), "route-1");
    await user.selectOptions(screen.getByLabelText("Direction"), "TO_AND_FRO");
    expect(screen.getByText("Fare: ₦9,000.00")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(billingApi.saveStudentBillAdjustments).toHaveBeenCalled());
    const [, , , , transportRouteId, transportDirection] = vi.mocked(billingApi.saveStudentBillAdjustments).mock
      .calls[0];
    expect(transportRouteId).toBe("route-1");
    expect(transportDirection).toBe("TO_AND_FRO");
  });

  it("disables the direction not priced on the selected route", async () => {
    const user = userEvent.setup();
    renderModal({
      transport: {
        assignable: true,
        unassignableReason: null,
        routeId: null,
        direction: null,
        amount: null,
        routes: [{ routeId: "route-1", routeName: "Ikeja", oneWayAmount: 5000, toAndFroAmount: null }],
      },
    });

    await user.selectOptions(screen.getByLabelText("Route"), "route-1");

    expect(screen.getByRole("option", { name: /Two ways \(not priced\)/ })).toBeDisabled();
  });

  it("rejects saving a route with no chosen direction", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.selectOptions(screen.getByLabelText("Route"), "route-1");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText(/Choose a direction for the school bus/)).toBeInTheDocument();
    expect(billingApi.saveStudentBillAdjustments).not.toHaveBeenCalled();
  });

  it("shows the unassignable reason instead of the picker when no route is priced for this session yet", () => {
    renderModal({
      transport: {
        assignable: false,
        unassignableReason: "No school-bus route is priced for this session yet.",
        routeId: null,
        direction: null,
        amount: null,
        routes: [],
      },
    });

    expect(screen.getByText("No school-bus route is priced for this session yet.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Route")).not.toBeInTheDocument();
  });

  it("seeds the picker from an existing assignment", () => {
    renderModal({
      transport: {
        assignable: true,
        unassignableReason: null,
        routeId: "route-1",
        direction: "ONE_WAY",
        amount: 5000,
        routes: [{ routeId: "route-1", routeName: "Ikeja", oneWayAmount: 5000, toAndFroAmount: 9000 }],
      },
    });

    expect(screen.getByLabelText("Route")).toHaveValue("route-1");
    expect(screen.getByLabelText("Direction")).toHaveValue("ONE_WAY");
    expect(screen.getByText("Fare: ₦5,000.00")).toBeInTheDocument();
  });
});

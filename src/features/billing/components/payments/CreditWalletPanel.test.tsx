import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StudentCreditView } from "@/api/feePayments";
import * as api from "@/api/staffFeePayments";
import { CreditWalletPanel } from "@/features/billing/components/payments/CreditWalletPanel";

vi.mock("@/api/staffFeePayments", async () => {
  const actual =
    await vi.importActual<typeof import("@/api/staffFeePayments")>("@/api/staffFeePayments");
  return {
    ...actual,
    getStudentCredit: vi.fn(),
    applyStudentCredit: vi.fn(),
    reverseCreditApplication: vi.fn(),
  };
});

function wallet(overrides: Partial<StudentCreditView> = {}): StudentCreditView {
  return {
    studentId: "student-1",
    currency: "NGN",
    available: 2000,
    sources: [{ termId: "term-1", termName: "First Term", sessionName: "2026/2027", available: 2000 }],
    targets: [
      { termId: "term-2", termName: "Second Term", sessionName: "2026/2027", balance: 5000, applicable: 2000 },
    ],
    applications: [],
    ...overrides,
  };
}

const APPLIED = {
  id: "app-1",
  version: 0,
  sourceTermId: "term-1",
  sourceTermName: "First Term",
  sourceSessionName: "2026/2027",
  targetTermId: "term-2",
  targetTermName: "Second Term",
  targetSessionName: "2026/2027",
  amount: 2000,
  settlement: "PARTIAL" as const,
  note: "Carried",
  status: "APPLIED" as const,
  appliedAt: "2026-11-04T10:00:00Z",
};

function renderPanel(onChanged = vi.fn()) {
  render(
    <CreditWalletPanel
      studentId="student-1"
      studentName="Ada Obi"
      termId="term-2"
      refreshKey={0}
      onChanged={onChanged}
    />,
  );
  return onChanged;
}

describe("CreditWalletPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing for a student who never had credit", async () => {
    vi.mocked(api.getStudentCredit).mockResolvedValue(
      wallet({ available: 0, sources: [], targets: [], applications: [] }),
    );
    const { container } = render(
      <CreditWalletPanel studentId="student-1" studentName="Ada" termId="t" refreshKey={0} onChanged={vi.fn()} />,
    );
    await waitFor(() => expect(api.getStudentCredit).toHaveBeenCalledWith("student-1"));
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the wallet and applies credit to the chosen term", async () => {
    const user = userEvent.setup();
    vi.mocked(api.getStudentCredit).mockResolvedValue(wallet());
    vi.mocked(api.applyStudentCredit).mockResolvedValue(
      wallet({ available: 0, sources: [], targets: [], applications: [APPLIED] }),
    );
    const onChanged = renderPanel();

    expect(await screen.findByText("Credit wallet")).toBeInTheDocument();
    expect(screen.getByText("Overpaid in First Term (2026/2027)")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Apply credit" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByLabelText("Amount")).toHaveValue("2000");
    await user.click(within(dialog).getByRole("button", { name: "Apply credit" }));

    await waitFor(() =>
      expect(api.applyStudentCredit).toHaveBeenCalledWith("student-1", {
        targetTermId: "term-2",
        amount: 2000,
        settlement: "PARTIAL",
        note: null,
      }),
    );
    expect(onChanged).toHaveBeenCalledWith("Credit applied.");
    expect(await screen.findByText("2,000.00", { exact: false })).toBeInTheDocument();
  });

  it("blocks an amount above what the term can take", async () => {
    const user = userEvent.setup();
    vi.mocked(api.getStudentCredit).mockResolvedValue(wallet());
    renderPanel();

    await user.click(await screen.findByRole("button", { name: "Apply credit" }));
    const dialog = await screen.findByRole("dialog");
    const amount = within(dialog).getByLabelText("Amount");
    await user.clear(amount);
    await user.type(amount, "2500");

    expect(within(dialog).getByText("That's more than can be applied to this term.")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Apply credit" })).toBeDisabled();
  });

  it("reverses an application with a reason", async () => {
    const user = userEvent.setup();
    vi.mocked(api.getStudentCredit).mockResolvedValue(
      wallet({ available: 0, sources: [], targets: [], applications: [APPLIED] }),
    );
    vi.mocked(api.reverseCreditApplication).mockResolvedValue(
      wallet({ applications: [{ ...APPLIED, version: 1, status: "REVERSED", reverseReason: "Wrong term" }] }),
    );
    const onChanged = renderPanel();

    await user.click(await screen.findByRole("button", { name: "Reverse" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByRole("textbox"), "Wrong term");
    await user.click(within(dialog).getByRole("button", { name: "Reverse credit" }));

    await waitFor(() => expect(api.reverseCreditApplication).toHaveBeenCalledWith("app-1", 0, "Wrong term"));
    expect(onChanged).toHaveBeenCalledWith("Credit reversed.");
    expect(await screen.findByText("Reversed")).toBeInTheDocument();
  });
});

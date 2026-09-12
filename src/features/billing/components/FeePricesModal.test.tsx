import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as billingApi from "@/api/billing";
import type { FeePriceLevelColumn, FeePriceRow } from "@/api/billing";
import { ApiError } from "@/api/client";
import { FeePricesModal } from "@/features/billing/components/FeePricesModal";

vi.mock("@/api/billing", async () => {
  const actual = await vi.importActual<typeof import("@/api/billing")>("@/api/billing");
  return { ...actual, saveFeePrices: vi.fn() };
});

const LEVELS: FeePriceLevelColumn[] = [
  { levelId: "level-1", levelName: "Primary" },
  { levelId: "level-2", levelName: "Secondary" },
];

const FEE: FeePriceRow = {
  feeId: "fee-1",
  feeName: "Tuition",
  applicability: "TERMLY",
  termNumbers: [1, 2, 3],
  compulsory: true,
  priceVariesByTerm: false,
  applicableLevelIds: ["level-1", "level-2"],
  prices: [{ levelId: "level-1", termNumber: null, amount: 1000 }],
};

const PER_TERM_FEE: FeePriceRow = {
  feeId: "fee-1",
  feeName: "Tuition",
  applicability: "TERMLY",
  termNumbers: [1, 2, 3],
  compulsory: true,
  priceVariesByTerm: true,
  applicableLevelIds: ["level-1", "level-2"],
  prices: [
    { levelId: "level-1", termNumber: 1, amount: 15000 },
    { levelId: "level-1", termNumber: 2, amount: 15000 },
  ],
};

function renderModal(overrides: Partial<Parameters<typeof FeePricesModal>[0]> = {}) {
  const onClose = vi.fn();
  const onSaved = vi.fn();
  render(
    <FeePricesModal
      fee={FEE}
      levels={LEVELS}
      branchName="Main Campus"
      sessionName="2026/2027"
      sessionId="session-1"
      branchId="branch-1"
      currency="NGN"
      onClose={onClose}
      onSaved={onSaved}
      {...overrides}
    />,
  );
  return { onClose, onSaved };
}

describe("FeePricesModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("still renders one input per level for a uniform fee", () => {
    renderModal();

    const primary = screen.getByLabelText("Tuition price for Primary") as HTMLInputElement;
    const secondary = screen.getByLabelText("Tuition price for Secondary") as HTMLInputElement;
    expect(primary.value).toBe("1000");
    expect(secondary.value).toBe("");
  });

  it("Save is disabled until something changes", () => {
    renderModal();

    expect(screen.getByRole("button", { name: "Save prices" })).toBeDisabled();
  });

  it("submits only the levels that actually changed", async () => {
    const user = userEvent.setup();
    vi.mocked(billingApi.saveFeePrices).mockResolvedValue({
      outcomes: [{ feeId: "fee-1", levelId: "level-2", termNumber: null, success: true, message: null }],
    });
    const { onSaved } = renderModal();

    await user.type(screen.getByLabelText("Tuition price for Secondary"), "2000");
    await user.click(screen.getByRole("button", { name: "Save prices" }));

    await waitFor(() =>
      expect(billingApi.saveFeePrices).toHaveBeenCalledWith(
        "session-1",
        [{ feeId: "fee-1", levelId: "level-2", termNumber: null, amount: 2000 }],
        "branch-1",
      ),
    );
    expect(onSaved).toHaveBeenCalledWith("1 price saved.");
  });

  it("clearing a priced level sends a null amount", async () => {
    const user = userEvent.setup();
    vi.mocked(billingApi.saveFeePrices).mockResolvedValue({
      outcomes: [{ feeId: "fee-1", levelId: "level-1", termNumber: null, success: true, message: null }],
    });
    renderModal();

    await user.clear(screen.getByLabelText("Tuition price for Primary"));
    await user.click(screen.getByRole("button", { name: "Save prices" }));

    await waitFor(() =>
      expect(billingApi.saveFeePrices).toHaveBeenCalledWith(
        "session-1",
        [{ feeId: "fee-1", levelId: "level-1", termNumber: null, amount: null }],
        "branch-1",
      ),
    );
  });

  it("Set all to fills every applicable level", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByLabelText("Set all to"), "5000");
    await user.click(screen.getByRole("button", { name: "Apply" }));

    expect((screen.getByLabelText("Tuition price for Primary") as HTMLInputElement).value).toBe("5000");
    expect((screen.getByLabelText("Tuition price for Secondary") as HTMLInputElement).value).toBe("5000");
  });

  it("a failed row outcome keeps the modal open and shows the message against that level", async () => {
    const user = userEvent.setup();
    vi.mocked(billingApi.saveFeePrices).mockResolvedValue({
      outcomes: [
        {
          feeId: "fee-1",
          levelId: "level-2",
          termNumber: null,
          success: false,
          message: "'Tuition' does not apply to this level.",
        },
      ],
    });
    const { onClose, onSaved } = renderModal();

    await user.type(screen.getByLabelText("Tuition price for Secondary"), "2000");
    await user.click(screen.getByRole("button", { name: "Save prices" }));

    expect(await screen.findByText("'Tuition' does not apply to this level.")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("a negative amount blocks submit with no API call", async () => {
    const user = userEvent.setup();
    renderModal();

    await user.type(screen.getByLabelText("Tuition price for Secondary"), "-5");
    await user.click(screen.getByRole("button", { name: "Save prices" }));

    expect(await screen.findByText("Enter a number 0 or greater.")).toBeInTheDocument();
    expect(billingApi.saveFeePrices).not.toHaveBeenCalled();
  });

  it("surfaces a thrown ApiError message", async () => {
    const user = userEvent.setup();
    vi.mocked(billingApi.saveFeePrices).mockRejectedValue(new ApiError(500, "Failed to save prices"));
    renderModal();

    await user.type(screen.getByLabelText("Tuition price for Secondary"), "2000");
    await user.click(screen.getByRole("button", { name: "Save prices" }));

    expect(await screen.findByText("Failed to save prices")).toBeInTheDocument();
  });

  describe("a per-term fee", () => {
    it("renders one input per level and term", () => {
      renderModal({ fee: PER_TERM_FEE });

      const term1Inputs = screen.getAllByLabelText("Term 1") as HTMLInputElement[];
      const term2Inputs = screen.getAllByLabelText("Term 2") as HTMLInputElement[];
      const term3Inputs = screen.getAllByLabelText("Term 3") as HTMLInputElement[];
      expect(term1Inputs).toHaveLength(2);
      expect(term2Inputs).toHaveLength(2);
      expect(term3Inputs).toHaveLength(2);
      // Primary's term 1/2 are seeded from `prices`, term 3 and every Secondary term are blank.
      expect(term1Inputs.map((el) => el.value)).toContain("15000");
      expect(term2Inputs.map((el) => el.value)).toContain("15000");
      expect(term3Inputs.every((el) => el.value === "")).toBe(true);
    });

    it("submits only the (level, term) cells that changed", async () => {
      const user = userEvent.setup();
      vi.mocked(billingApi.saveFeePrices).mockResolvedValue({
        outcomes: [{ feeId: "fee-1", levelId: "level-1", termNumber: 3, success: true, message: null }],
      });
      renderModal({ fee: PER_TERM_FEE });

      await user.type(document.getElementById("fee-price-level-1-3") as HTMLInputElement, "18000");
      await user.click(screen.getByRole("button", { name: "Save prices" }));

      await waitFor(() =>
        expect(billingApi.saveFeePrices).toHaveBeenCalledWith(
          "session-1",
          [{ feeId: "fee-1", levelId: "level-1", termNumber: 3, amount: 18000 }],
          "branch-1",
        ),
      );
    });

    it("clearing one term sends a null amount for that term only", async () => {
      const user = userEvent.setup();
      vi.mocked(billingApi.saveFeePrices).mockResolvedValue({
        outcomes: [{ feeId: "fee-1", levelId: "level-1", termNumber: 1, success: true, message: null }],
      });
      renderModal({ fee: PER_TERM_FEE });

      await user.clear(document.getElementById("fee-price-level-1-1") as HTMLInputElement);
      await user.click(screen.getByRole("button", { name: "Save prices" }));

      await waitFor(() =>
        expect(billingApi.saveFeePrices).toHaveBeenCalledWith(
          "session-1",
          [{ feeId: "fee-1", levelId: "level-1", termNumber: 1, amount: null }],
          "branch-1",
        ),
      );
    });

    it("a failed row outcome highlights only that level's failing term", async () => {
      const user = userEvent.setup();
      vi.mocked(billingApi.saveFeePrices).mockResolvedValue({
        outcomes: [
          {
            feeId: "fee-1",
            levelId: "level-1",
            termNumber: 3,
            success: false,
            message: "Term number must be between 1 and 3.",
          },
        ],
      });
      renderModal({ fee: PER_TERM_FEE });

      await user.type(document.getElementById("fee-price-level-1-3") as HTMLInputElement, "18000");
      await user.click(screen.getByRole("button", { name: "Save prices" }));

      expect(await screen.findByText("Term number must be between 1 and 3.")).toBeInTheDocument();
    });

    it("Set all to fills every level and every term", async () => {
      const user = userEvent.setup();
      renderModal({ fee: PER_TERM_FEE });

      await user.type(screen.getByLabelText("Set all to"), "20000");
      await user.click(screen.getByRole("button", { name: "Apply" }));

      const inputs = [
        document.getElementById("fee-price-level-1-1"),
        document.getElementById("fee-price-level-1-2"),
        document.getElementById("fee-price-level-1-3"),
        document.getElementById("fee-price-level-2-1"),
        document.getElementById("fee-price-level-2-2"),
        document.getElementById("fee-price-level-2-3"),
      ] as HTMLInputElement[];
      expect(inputs.every((el) => el.value === "20000")).toBe(true);
    });
  });
});

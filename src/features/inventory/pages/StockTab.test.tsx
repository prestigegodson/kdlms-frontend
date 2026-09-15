import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as inventoryApi from "@/api/inventory";
import type { InventoryItemView, StockLevelView } from "@/api/inventory";
import { StockTab } from "@/features/inventory/pages/StockTab";
import { resetAuthStore, useAuthStore } from "@/stores/authStore";
import { resetBranchStore } from "@/stores/branchStore";

vi.mock("@/api/inventory", async () => {
  const actual = await vi.importActual<typeof import("@/api/inventory")>("@/api/inventory");
  return { ...actual, getStockLevels: vi.fn(), listItems: vi.fn(), receiveStock: vi.fn(), adjustStock: vi.fn() };
});

const BLUE_UNIFORM: InventoryItemView = {
  id: "item-1",
  itemTypeId: "type-1",
  itemTypeName: "School Uniform",
  name: "Blue Uniform (Size 4)",
  code: null,
  description: null,
  unit: "piece",
  unitPrice: null,
  reorderLevel: 10,
  active: true,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

const LOW_STOCK_LEVEL: StockLevelView = {
  itemId: "item-1",
  itemName: "Blue Uniform (Size 4)",
  itemTypeName: "School Uniform",
  unit: "piece",
  onHand: 7,
  reorderLevel: 10,
  lowStock: true,
  band: "LOW",
};

const APPROACHING_LEVEL: StockLevelView = {
  ...LOW_STOCK_LEVEL,
  onHand: 12,
  lowStock: false,
  band: "APPROACHING",
};

function signInAs(role: "SCHOOL_ADMIN" | "BRANCH_ADMIN" | "INVENTORY_MANAGER") {
  useAuthStore.setState({
    user: {
      id: "user-1",
      email: "admin@school.example",
      firstName: "Ada",
      lastName: "Obi",
      role,
      schoolId: "school-1",
      branchId: role === "SCHOOL_ADMIN" ? undefined : "branch-1",
    },
    accessToken: "access",
    refreshToken: "refresh",
  });
}

describe("StockTab", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    resetAuthStore();
    resetBranchStore();
    signInAs("BRANCH_ADMIN"); // no branch picker to stub, useBranchScope is immediately ready
    vi.mocked(inventoryApi.listItems).mockResolvedValue([BLUE_UNIFORM]);
  });

  it("renders on-hand quantities with a low-stock badge", async () => {
    vi.mocked(inventoryApi.getStockLevels).mockResolvedValue([LOW_STOCK_LEVEL]);

    render(<StockTab />);

    expect(await screen.findByText("Blue Uniform (Size 4)")).toBeInTheDocument();
    expect(screen.getByText("Low stock")).toBeInTheDocument();
  });

  it("an approaching-reorder item renders its own badge, not OK", async () => {
    vi.mocked(inventoryApi.getStockLevels).mockResolvedValue([APPROACHING_LEVEL]);

    render(<StockTab />);

    expect(await screen.findByText("Blue Uniform (Size 4)")).toBeInTheDocument();
    expect(screen.getByText("Approaching")).toBeInTheDocument();
    expect(screen.queryByText("OK")).not.toBeInTheDocument();
  });

  it("an empty branch shows the empty state", async () => {
    vi.mocked(inventoryApi.getStockLevels).mockResolvedValue([]);

    render(<StockTab />);

    expect(await screen.findByText("No stock yet")).toBeInTheDocument();
  });

  it("receives stock through the modal", async () => {
    vi.mocked(inventoryApi.getStockLevels).mockResolvedValue([]);
    vi.mocked(inventoryApi.receiveStock).mockResolvedValue({
      id: "movement-1",
      itemId: "item-1",
      itemName: "Blue Uniform (Size 4)",
      kind: "RECEIPT",
      quantity: 20,
      reason: null,
      reference: null,
      requisitionId: null,
      requisitionReference: null,
      occurredOn: "2026-01-01",
      createdBy: "user-1",
      createdByName: "Ada Obi",
      createdAt: "2026-01-01T00:00:00Z",
    });
    const user = userEvent.setup();

    render(<StockTab />);
    await screen.findByText("No stock yet");

    await user.click(screen.getByRole("button", { name: "Receive stock" }));
    const dialog = await screen.findByRole("dialog", { name: "Receive stock" });
    await user.clear(within(dialog).getByLabelText("Quantity"));
    await user.type(within(dialog).getByLabelText("Quantity"), "20");
    await user.click(within(dialog).getByRole("button", { name: "Receive stock" }));

    await waitFor(() =>
      expect(inventoryApi.receiveStock).toHaveBeenCalledWith(
        expect.objectContaining({ itemId: "item-1", quantity: 20 }),
      ),
    );
  });

  it("an INVENTORY_MANAGER reads on-hand quantities but gets no Receive/Adjust controls", async () => {
    signInAs("INVENTORY_MANAGER");
    vi.mocked(inventoryApi.getStockLevels).mockResolvedValue([LOW_STOCK_LEVEL]);

    render(<StockTab />);

    expect(await screen.findByText("Blue Uniform (Size 4)")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Receive stock" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Adjust stock" })).not.toBeInTheDocument();
  });
});

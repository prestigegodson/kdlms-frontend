import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as inventoryApi from "@/api/inventory";
import type { InventoryItemView } from "@/api/inventory";
import { InventoryPage } from "@/features/inventory/InventoryPage";
import { resetAuthStore, useAuthStore } from "@/stores/authStore";
import { resetBranchStore } from "@/stores/branchStore";

vi.mock("@/api/inventory", async () => {
  const actual = await vi.importActual<typeof import("@/api/inventory")>("@/api/inventory");
  return {
    ...actual,
    getStockLevels: vi.fn(),
    listItems: vi.fn(),
    listRequisitions: vi.fn(),
    listItemTypes: vi.fn(),
  };
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

function renderAt(path: string) {
  const router = createMemoryRouter([{ path: "/school/inventory", element: <InventoryPage /> }], {
    initialEntries: [path],
  });
  render(<RouterProvider router={router} />);
}

describe("InventoryPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAuthStore();
    resetBranchStore();
    useAuthStore.setState({
      user: {
        id: "user-1",
        email: "admin@school.example",
        firstName: "Ada",
        lastName: "Obi",
        role: "BRANCH_ADMIN",
        schoolId: "school-1",
        branchId: "branch-1",
      },
      accessToken: "access",
      refreshToken: "refresh",
    });
    vi.mocked(inventoryApi.listItems).mockResolvedValue([BLUE_UNIFORM]);
    vi.mocked(inventoryApi.listRequisitions).mockResolvedValue([]);
    vi.mocked(inventoryApi.getStockLevels).mockResolvedValue([]);
  });

  it("defaults to the Requisitions tab", async () => {
    renderAt("/school/inventory");

    expect(await screen.findByRole("tab", { name: "Requisitions" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("?tab=stock opens the Stock tab", async () => {
    renderAt("/school/inventory?tab=stock");

    expect(await screen.findByRole("tab", { name: "Stock" })).toHaveAttribute("aria-selected", "true");
    expect(await screen.findByText("No stock yet")).toBeInTheDocument();
  });

  it("?tab=requisitions&status=SUBMITTED seeds the Requisitions tab's status filter", async () => {
    renderAt("/school/inventory?tab=requisitions&status=SUBMITTED");

    expect(await screen.findByRole("tab", { name: "Requisitions" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(await screen.findByLabelText("Status")).toHaveValue("SUBMITTED");
  });
});

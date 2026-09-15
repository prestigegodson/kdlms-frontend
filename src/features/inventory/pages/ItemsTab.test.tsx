import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as inventoryApi from "@/api/inventory";
import type { InventoryItemTypeView, InventoryItemView } from "@/api/inventory";
import { ApiError } from "@/api/client";
import { ItemsTab } from "@/features/inventory/pages/ItemsTab";
import { resetAuthStore, useAuthStore } from "@/stores/authStore";

vi.mock("@/api/inventory", async () => {
  const actual = await vi.importActual<typeof import("@/api/inventory")>("@/api/inventory");
  return {
    ...actual,
    listItemTypes: vi.fn(),
    listItems: vi.fn(),
    createItem: vi.fn(),
    updateItem: vi.fn(),
    deleteItem: vi.fn(),
  };
});

const UNIFORM_TYPE: InventoryItemTypeView = {
  id: "type-1",
  name: "School Uniform",
  description: null,
  active: true,
  position: 0,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

const BLUE_UNIFORM: InventoryItemView = {
  id: "item-1",
  itemTypeId: "type-1",
  itemTypeName: "School Uniform",
  name: "Blue Uniform (Size 4)",
  code: "UNI-B4",
  description: null,
  unit: "piece",
  unitPrice: 15,
  reorderLevel: 10,
  active: true,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

function signInAs(role: "SCHOOL_ADMIN" | "BRANCH_ADMIN" | "INVENTORY_MANAGER") {
  useAuthStore.setState({
    user: { id: "user-1", email: "admin@school.example", firstName: "Ada", lastName: "Obi", role, schoolId: "school-1" },
    accessToken: "access",
    refreshToken: "refresh",
  });
}

describe("ItemsTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAuthStore();
    signInAs("SCHOOL_ADMIN");
    vi.mocked(inventoryApi.listItemTypes).mockResolvedValue([UNIFORM_TYPE]);
  });

  it("renders the item catalogue", async () => {
    vi.mocked(inventoryApi.listItems).mockResolvedValue([BLUE_UNIFORM]);

    render(<ItemsTab />);

    expect(await screen.findByText("Blue Uniform (Size 4)")).toBeInTheDocument();
    expect(screen.getByText("School Uniform")).toBeInTheDocument();
    expect(screen.getByText("UNI-B4")).toBeInTheDocument();
  });

  it("creates an item through the modal", async () => {
    vi.mocked(inventoryApi.listItems).mockResolvedValue([]);
    vi.mocked(inventoryApi.createItem).mockResolvedValue(BLUE_UNIFORM);
    const user = userEvent.setup();

    render(<ItemsTab />);
    await screen.findByText("No items yet");

    await user.click(screen.getByRole("button", { name: "Add item" }));
    const dialog = await screen.findByRole("dialog", { name: "Add item" });
    await user.type(within(dialog).getByLabelText("Name"), "Blue Uniform (Size 4)");
    await user.click(within(dialog).getByRole("button", { name: "Add item" }));

    await waitFor(() =>
      expect(inventoryApi.createItem).toHaveBeenCalledWith(
        expect.objectContaining({ itemTypeId: "type-1", name: "Blue Uniform (Size 4)" }),
      ),
    );
  });

  it("a BRANCH_ADMIN sees no write controls", async () => {
    signInAs("BRANCH_ADMIN");
    vi.mocked(inventoryApi.listItems).mockResolvedValue([BLUE_UNIFORM]);

    render(<ItemsTab />);

    await screen.findByText("Blue Uniform (Size 4)");
    expect(screen.queryByRole("button", { name: "Add item" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
  });

  it("an INVENTORY_MANAGER sees the same read-only catalogue as a BRANCH_ADMIN", async () => {
    signInAs("INVENTORY_MANAGER");
    vi.mocked(inventoryApi.listItems).mockResolvedValue([BLUE_UNIFORM]);

    render(<ItemsTab />);

    await screen.findByText("Blue Uniform (Size 4)");
    expect(screen.queryByRole("button", { name: "Add item" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
  });

  it("renders a delete rejection's message inline", async () => {
    vi.mocked(inventoryApi.listItems).mockResolvedValue([BLUE_UNIFORM]);
    vi.mocked(inventoryApi.deleteItem).mockRejectedValue(
      new ApiError(422, "'Blue Uniform (Size 4)' has been used and can no longer be deleted - deactivate it instead."),
    );
    const user = userEvent.setup();

    render(<ItemsTab />);
    await screen.findByText("Blue Uniform (Size 4)");

    await user.click(screen.getByRole("button", { name: "Delete" }));
    const dialog = await screen.findByRole("dialog", { name: "Delete item" });
    await user.click(within(dialog).getByRole("button", { name: "Delete" }));

    expect(
      await screen.findByText(
        "'Blue Uniform (Size 4)' has been used and can no longer be deleted - deactivate it instead.",
      ),
    ).toBeInTheDocument();
  });
});

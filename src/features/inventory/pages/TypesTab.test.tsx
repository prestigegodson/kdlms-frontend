import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as inventoryApi from "@/api/inventory";
import type { InventoryItemTypeView } from "@/api/inventory";
import { ApiError } from "@/api/client";
import { TypesTab } from "@/features/inventory/pages/TypesTab";
import { resetAuthStore, useAuthStore } from "@/stores/authStore";

vi.mock("@/api/inventory", async () => {
  const actual = await vi.importActual<typeof import("@/api/inventory")>("@/api/inventory");
  return { ...actual, listItemTypes: vi.fn(), createItemType: vi.fn(), updateItemType: vi.fn(), deleteItemType: vi.fn() };
});

const UNIFORMS: InventoryItemTypeView = {
  id: "type-1",
  name: "School Uniform",
  description: null,
  active: true,
  position: 0,
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

describe("TypesTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAuthStore();
    signInAs("SCHOOL_ADMIN");
  });

  it("renders the item-type catalogue", async () => {
    vi.mocked(inventoryApi.listItemTypes).mockResolvedValue([UNIFORMS]);

    render(<TypesTab />);

    expect(await screen.findByText("School Uniform")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("creates an item type through the modal", async () => {
    vi.mocked(inventoryApi.listItemTypes).mockResolvedValue([]);
    vi.mocked(inventoryApi.createItemType).mockResolvedValue(UNIFORMS);
    const user = userEvent.setup();

    render(<TypesTab />);
    await screen.findByText("No item types yet");

    await user.click(screen.getByRole("button", { name: "Add item type" }));
    const dialog = await screen.findByRole("dialog", { name: "Add item type" });
    await user.type(within(dialog).getByLabelText("Name"), "School Uniform");
    await user.click(within(dialog).getByRole("button", { name: "Add item type" }));

    await waitFor(() =>
      expect(inventoryApi.createItemType).toHaveBeenCalledWith(
        expect.objectContaining({ name: "School Uniform", active: true }),
      ),
    );
  });

  it("a BRANCH_ADMIN sees no write controls", async () => {
    signInAs("BRANCH_ADMIN");
    vi.mocked(inventoryApi.listItemTypes).mockResolvedValue([UNIFORMS]);

    render(<TypesTab />);

    await screen.findByText("School Uniform");
    expect(screen.queryByRole("button", { name: "Add item type" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
  });

  it("an INVENTORY_MANAGER sees the same read-only catalogue as a BRANCH_ADMIN", async () => {
    signInAs("INVENTORY_MANAGER");
    vi.mocked(inventoryApi.listItemTypes).mockResolvedValue([UNIFORMS]);

    render(<TypesTab />);

    await screen.findByText("School Uniform");
    expect(screen.queryByRole("button", { name: "Add item type" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
  });

  it("renders a delete rejection's message inline, without closing the confirm dialog", async () => {
    vi.mocked(inventoryApi.listItemTypes).mockResolvedValue([UNIFORMS]);
    vi.mocked(inventoryApi.deleteItemType).mockRejectedValue(
      new ApiError(422, "'School Uniform' still has items - deactivate it instead."),
    );
    const user = userEvent.setup();

    render(<TypesTab />);
    await screen.findByText("School Uniform");

    await user.click(screen.getByRole("button", { name: "Delete" }));
    const dialog = await screen.findByRole("dialog", { name: "Delete item type" });
    await user.click(within(dialog).getByRole("button", { name: "Delete" }));

    expect(await screen.findByText("'School Uniform' still has items - deactivate it instead.")).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Delete item type" })).toBeInTheDocument();
  });
});

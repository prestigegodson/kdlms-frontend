import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as inventoryApi from "@/api/inventory";
import type { InventoryItemView, RequisitionSummaryView, RequisitionView } from "@/api/inventory";
import { RequisitionsTab } from "@/features/inventory/pages/RequisitionsTab";
import { resetAuthStore, useAuthStore } from "@/stores/authStore";
import { resetBranchStore } from "@/stores/branchStore";

vi.mock("@/api/inventory", async () => {
  const actual = await vi.importActual<typeof import("@/api/inventory")>("@/api/inventory");
  return {
    ...actual,
    listRequisitions: vi.fn(),
    listItems: vi.fn(),
    getRequisition: vi.fn(),
    createRequisition: vi.fn(),
    submitRequisition: vi.fn(),
    approveRequisition: vi.fn(),
    issueRequisition: vi.fn(),
    cancelRequisition: vi.fn(),
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

const DRAFT_SUMMARY: RequisitionSummaryView = {
  id: "req-1",
  reference: "REQ/2026/0001",
  status: "DRAFT",
  branchId: "branch-1",
  branchName: "Main Campus",
  neededBy: null,
  lineCount: 1,
  requestedByName: "Ada Obi",
  createdAt: "2026-01-01T00:00:00Z",
};

const DRAFT_DETAIL: RequisitionView = {
  id: "req-1",
  reference: "REQ/2026/0001",
  status: "DRAFT",
  branchId: "branch-1",
  branchName: "Main Campus",
  purpose: "Restock",
  neededBy: null,
  lines: [
    {
      id: "line-1",
      itemId: "item-1",
      itemName: "Blue Uniform (Size 4)",
      unit: "piece",
      quantityRequested: 10,
      quantityApproved: null,
      note: null,
    },
  ],
  requestedBy: "user-1",
  requestedByName: "Ada Obi",
  submittedAt: null,
  reviewedBy: null,
  reviewedByName: null,
  reviewedAt: null,
  reviewNote: null,
  issuedBy: null,
  issuedByName: null,
  issuedAt: null,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
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

describe("RequisitionsTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAuthStore();
    resetBranchStore();
    signInAs("BRANCH_ADMIN");
    vi.mocked(inventoryApi.listItems).mockResolvedValue([BLUE_UNIFORM]);
  });

  it("renders the requisition worklist", async () => {
    vi.mocked(inventoryApi.listRequisitions).mockResolvedValue([DRAFT_SUMMARY]);

    render(<RequisitionsTab />);

    expect(await screen.findByText("REQ/2026/0001")).toBeInTheDocument();
    expect(screen.getByText("Draft")).toBeInTheDocument();
  });

  it("creates a requisition through the modal", async () => {
    vi.mocked(inventoryApi.listRequisitions).mockResolvedValue([]);
    vi.mocked(inventoryApi.createRequisition).mockResolvedValue(DRAFT_DETAIL);
    const user = userEvent.setup();

    render(<RequisitionsTab />);
    await screen.findByText("No requisitions yet");

    await user.click(screen.getByRole("button", { name: "New requisition" }));
    const dialog = await screen.findByRole("dialog", { name: "New requisition" });
    await user.selectOptions(within(dialog).getByLabelText("Item"), "item-1");
    await user.click(within(dialog).getByRole("button", { name: "Create requisition" }));

    await waitFor(() =>
      expect(inventoryApi.createRequisition).toHaveBeenCalledWith(
        expect.objectContaining({
          lines: [{ itemId: "item-1", quantityRequested: 1, note: null }],
        }),
      ),
    );
  });

  it("opens the detail modal and submits a DRAFT requisition", async () => {
    vi.mocked(inventoryApi.listRequisitions).mockResolvedValue([DRAFT_SUMMARY]);
    vi.mocked(inventoryApi.getRequisition).mockResolvedValue(DRAFT_DETAIL);
    vi.mocked(inventoryApi.submitRequisition).mockResolvedValue({
      ...DRAFT_DETAIL,
      status: "SUBMITTED",
      submittedAt: "2026-01-02T00:00:00Z",
    });
    const user = userEvent.setup();

    render(<RequisitionsTab />);
    await user.click(await screen.findByText("REQ/2026/0001"));

    const dialog = await screen.findByRole("dialog", { name: "REQ/2026/0001" });
    await user.click(within(dialog).getByRole("button", { name: "Submit" }));

    await waitFor(() => expect(inventoryApi.submitRequisition).toHaveBeenCalledWith("req-1"));
  });

  it("a SCHOOL_ADMIN sees the branch filter; approving requires a per-line quantity", async () => {
    signInAs("SCHOOL_ADMIN");
    vi.mocked(inventoryApi.listRequisitions).mockResolvedValue([
      { ...DRAFT_SUMMARY, status: "SUBMITTED" },
    ]);
    vi.mocked(inventoryApi.getRequisition).mockResolvedValue({ ...DRAFT_DETAIL, status: "SUBMITTED" });
    vi.mocked(inventoryApi.approveRequisition).mockResolvedValue({
      ...DRAFT_DETAIL,
      status: "APPROVED",
      lines: [{ ...DRAFT_DETAIL.lines[0], quantityApproved: 8 }],
    });
    const user = userEvent.setup();

    render(<RequisitionsTab />);
    expect(await screen.findByLabelText("Branch")).toBeInTheDocument();

    await user.click(await screen.findByText("REQ/2026/0001"));
    const dialog = await screen.findByRole("dialog", { name: "REQ/2026/0001" });
    await user.click(within(dialog).getByRole("button", { name: "Approve" }));

    const approvedInput = await within(dialog).findByLabelText("Approved quantity for Blue Uniform (Size 4)");
    await user.clear(approvedInput);
    await user.type(approvedInput, "8");
    await user.click(within(dialog).getByRole("button", { name: "Confirm approval" }));

    await waitFor(() =>
      expect(inventoryApi.approveRequisition).toHaveBeenCalledWith("req-1", {
        quantityApprovedByLineId: { "line-1": 8 },
        reviewNote: null,
      }),
    );
  });

  it("an INVENTORY_MANAGER can raise a requisition but sees no branch filter or Approve/Reject/Issue controls", async () => {
    signInAs("INVENTORY_MANAGER");
    vi.mocked(inventoryApi.listRequisitions).mockResolvedValue([{ ...DRAFT_SUMMARY, status: "SUBMITTED" }]);
    vi.mocked(inventoryApi.getRequisition).mockResolvedValue({ ...DRAFT_DETAIL, status: "SUBMITTED" });
    const user = userEvent.setup();

    render(<RequisitionsTab />);
    expect(screen.queryByLabelText("Branch")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New requisition" })).toBeInTheDocument();

    await user.click(await screen.findByText("REQ/2026/0001"));
    const dialog = await screen.findByRole("dialog", { name: "REQ/2026/0001" });
    expect(within(dialog).queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Reject" })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Issue" })).not.toBeInTheDocument();
  });

  it("an INVENTORY_MANAGER can cancel their own APPROVED requisition but not issue it - cancel is an author action, not a review one", async () => {
    signInAs("INVENTORY_MANAGER");
    vi.mocked(inventoryApi.listRequisitions).mockResolvedValue([{ ...DRAFT_SUMMARY, status: "APPROVED" }]);
    vi.mocked(inventoryApi.getRequisition).mockResolvedValue({ ...DRAFT_DETAIL, status: "APPROVED" });
    vi.mocked(inventoryApi.cancelRequisition).mockResolvedValue({ ...DRAFT_DETAIL, status: "CANCELLED" });
    const user = userEvent.setup();

    render(<RequisitionsTab />);
    await user.click(await screen.findByText("REQ/2026/0001"));
    const dialog = await screen.findByRole("dialog", { name: "REQ/2026/0001" });
    expect(within(dialog).queryByRole("button", { name: "Issue" })).not.toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Cancel requisition" }));

    await waitFor(() => expect(inventoryApi.cancelRequisition).toHaveBeenCalledWith("req-1"));
  });
});

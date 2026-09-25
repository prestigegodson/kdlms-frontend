import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as inventoryApi from "@/api/inventory";
import type { RequisitionSummaryView, RequisitionView } from "@/api/inventory";
import { RequisitionsTab } from "@/features/inventory/pages/RequisitionsTab";
import { resetAuthStore, useAuthStore } from "@/stores/authStore";
import { resetBranchStore } from "@/stores/branchStore";

vi.mock("@/api/inventory", async () => {
  const actual = await vi.importActual<typeof import("@/api/inventory")>("@/api/inventory");
  return {
    ...actual,
    listRequisitions: vi.fn(),
    getRequisition: vi.fn(),
    createRequisition: vi.fn(),
    submitRequisition: vi.fn(),
    approveRequisition: vi.fn(),
    fulfilRequisition: vi.fn(),
    cancelRequisition: vi.fn(),
  };
});

const DRAFT_SUMMARY: RequisitionSummaryView = {
  id: "req-1",
  reference: "REQ/2026/0001",
  status: "DRAFT",
  branchId: "branch-1",
  branchName: "Main Campus",
  neededBy: null,
  lineCount: 1,
  totalRequestedAmount: 30000,
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
      itemId: null,
      itemName: "Projector bulb",
      unit: null,
      description: "Projector bulb",
      estimatedUnitCost: 15000,
      quantityRequested: 2,
      quantityApproved: null,
      requestedAmount: 30000,
      approvedAmount: null,
      note: null,
    },
  ],
  totalRequestedAmount: 30000,
  totalApprovedAmount: null,
  requestedBy: "user-1",
  requestedByName: "Ada Obi",
  submittedAt: null,
  reviewedBy: null,
  reviewedByName: null,
  reviewedAt: null,
  reviewNote: null,
  fulfilledBy: null,
  fulfilledByName: null,
  fulfilledAt: null,
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
  });

  it("renders the requisition worklist", async () => {
    vi.mocked(inventoryApi.listRequisitions).mockResolvedValue([
      DRAFT_SUMMARY,
      { ...DRAFT_SUMMARY, id: "req-2", reference: "REQ/2026/0002" },
    ]);

    render(<RequisitionsTab />);

    expect(await screen.findByText("REQ/2026/0001")).toBeInTheDocument();
    expect(screen.getAllByText("Draft")).toHaveLength(2);
  });

  it("the list shows the requisition's total requested amount", async () => {
    vi.mocked(inventoryApi.listRequisitions).mockResolvedValue([DRAFT_SUMMARY]);

    render(<RequisitionsTab />);

    expect(await screen.findByText("30,000.00")).toBeInTheDocument();
  });

  it("the detail modal renders per-line amounts and requisition totals, tagging a historic item line", async () => {
    const mixedDetail: RequisitionView = {
      ...DRAFT_DETAIL,
      lines: [
        DRAFT_DETAIL.lines[0],
        {
          id: "line-2",
          itemId: "item-1",
          itemName: "Blue Uniform (Size 4)",
          unit: "piece",
          description: null,
          estimatedUnitCost: null,
          quantityRequested: 10,
          quantityApproved: null,
          requestedAmount: null,
          approvedAmount: null,
          note: null,
        },
      ],
    };
    vi.mocked(inventoryApi.listRequisitions).mockResolvedValue([DRAFT_SUMMARY]);
    vi.mocked(inventoryApi.getRequisition).mockResolvedValue(mixedDetail);
    const user = userEvent.setup();

    render(<RequisitionsTab />);
    await user.click(await screen.findByText("REQ/2026/0001"));
    const dialog = await screen.findByRole("dialog", { name: "REQ/2026/0001" });

    expect(within(dialog).getByText("Inventory item (legacy)")).toBeInTheDocument();
    expect(within(dialog).getAllByText("30,000.00")).not.toHaveLength(0);
    expect(within(dialog).getByText(/Total requested:/)).toHaveTextContent("Total requested: 30,000.00");
  });

  it("creates a requisition through the modal", async () => {
    vi.mocked(inventoryApi.listRequisitions).mockResolvedValue([]);
    vi.mocked(inventoryApi.createRequisition).mockResolvedValue(DRAFT_DETAIL);
    const user = userEvent.setup();

    render(<RequisitionsTab />);
    await screen.findByText("No requisitions yet");

    await user.click(screen.getByRole("button", { name: "New requisition" }));
    const dialog = await screen.findByRole("dialog", { name: "New requisition" });
    await user.type(within(dialog).getByLabelText("Description"), "Projector bulb");
    await user.type(within(dialog).getByLabelText("Estimated unit cost"), "15000");
    await user.clear(within(dialog).getByLabelText("Quantity"));
    await user.type(within(dialog).getByLabelText("Quantity"), "2");

    expect(within(dialog).getByText("Total amount requested: 30,000.00")).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Create requisition" }));

    await waitFor(() =>
      expect(inventoryApi.createRequisition).toHaveBeenCalledWith(
        expect.objectContaining({
          lines: [{ description: "Projector bulb", estimatedUnitCost: 15000, quantityRequested: 2, note: null }],
        }),
      ),
    );
  });

  it("editing a requisition pre-fills its ad-hoc line, skipping a historic item line", async () => {
    const mixedDetail: RequisitionView = {
      ...DRAFT_DETAIL,
      lines: [
        DRAFT_DETAIL.lines[0],
        {
          id: "line-2",
          itemId: "item-1",
          itemName: "Blue Uniform (Size 4)",
          unit: "piece",
          description: null,
          estimatedUnitCost: null,
          quantityRequested: 10,
          quantityApproved: null,
          requestedAmount: null,
          approvedAmount: null,
          note: null,
        },
      ],
    };
    vi.mocked(inventoryApi.listRequisitions).mockResolvedValue([DRAFT_SUMMARY]);
    vi.mocked(inventoryApi.getRequisition).mockResolvedValue(mixedDetail);
    const user = userEvent.setup();

    render(<RequisitionsTab />);
    await user.click(await screen.findByText("REQ/2026/0001"));
    const detailDialog = await screen.findByRole("dialog", { name: "REQ/2026/0001" });
    await user.click(within(detailDialog).getByRole("button", { name: "Edit" }));

    const editDialog = await screen.findByRole("dialog", { name: "Edit requisition" });
    expect(within(editDialog).getByLabelText("Description")).toHaveValue("Projector bulb");
    expect(within(editDialog).getByLabelText("Estimated unit cost")).toHaveValue(15000);
    // Only the one ad-hoc line is editable - the historic item line never appears in this form.
    expect(within(editDialog).getAllByLabelText("Description")).toHaveLength(1);
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

  it("a SCHOOL_ADMIN sees the branch filter; approving requires a per-line quantity, then may mark it fulfilled", async () => {
    signInAs("SCHOOL_ADMIN");
    vi.mocked(inventoryApi.listRequisitions).mockResolvedValue([
      { ...DRAFT_SUMMARY, status: "APPROVED" },
    ]);
    const approvedDetail: RequisitionView = {
      ...DRAFT_DETAIL,
      status: "APPROVED",
      lines: [{ ...DRAFT_DETAIL.lines[0], quantityApproved: 2 }],
    };
    vi.mocked(inventoryApi.getRequisition)
      .mockResolvedValueOnce({ ...DRAFT_DETAIL, status: "SUBMITTED" })
      .mockResolvedValue(approvedDetail);
    vi.mocked(inventoryApi.approveRequisition).mockResolvedValue(approvedDetail);
    vi.mocked(inventoryApi.fulfilRequisition).mockResolvedValue({
      ...DRAFT_DETAIL,
      status: "FULFILLED",
      lines: [{ ...DRAFT_DETAIL.lines[0], quantityApproved: 2 }],
    });
    const user = userEvent.setup();

    render(<RequisitionsTab />);
    expect(await screen.findByLabelText("Branch")).toBeInTheDocument();

    await user.click(await screen.findByText("REQ/2026/0001"));
    const dialog = await screen.findByRole("dialog", { name: "REQ/2026/0001" });
    await user.click(within(dialog).getByRole("button", { name: "Approve" }));

    const approvedInput = await within(dialog).findByLabelText("Approved quantity for Projector bulb");
    await user.clear(approvedInput);
    await user.type(approvedInput, "2");
    await user.click(within(dialog).getByRole("button", { name: "Confirm approval" }));

    await waitFor(() =>
      expect(inventoryApi.approveRequisition).toHaveBeenCalledWith("req-1", {
        quantityApprovedByLineId: { "line-1": 2 },
        reviewNote: null,
      }),
    );

    await user.click(within(dialog).getByRole("button", { name: "Mark fulfilled" }));
    await waitFor(() => expect(inventoryApi.fulfilRequisition).toHaveBeenCalledWith("req-1"));
  });

  it("an INVENTORY_MANAGER can raise a requisition but sees no branch filter or Approve/Reject/fulfil controls", async () => {
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
    expect(within(dialog).queryByRole("button", { name: "Mark fulfilled" })).not.toBeInTheDocument();
  });

  it("an INVENTORY_MANAGER can cancel their own APPROVED requisition but not fulfil it - cancel is an author action, not a review one", async () => {
    signInAs("INVENTORY_MANAGER");
    vi.mocked(inventoryApi.listRequisitions).mockResolvedValue([{ ...DRAFT_SUMMARY, status: "APPROVED" }]);
    vi.mocked(inventoryApi.getRequisition).mockResolvedValue({ ...DRAFT_DETAIL, status: "APPROVED" });
    vi.mocked(inventoryApi.cancelRequisition).mockResolvedValue({ ...DRAFT_DETAIL, status: "CANCELLED" });
    const user = userEvent.setup();

    render(<RequisitionsTab />);
    await user.click(await screen.findByText("REQ/2026/0001"));
    const dialog = await screen.findByRole("dialog", { name: "REQ/2026/0001" });
    expect(within(dialog).queryByRole("button", { name: "Mark fulfilled" })).not.toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Cancel requisition" }));

    await waitFor(() => expect(inventoryApi.cancelRequisition).toHaveBeenCalledWith("req-1"));
  });
});

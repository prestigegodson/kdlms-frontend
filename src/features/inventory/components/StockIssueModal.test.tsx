import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/api/client";
import * as inventoryApi from "@/api/inventory";
import type { StockLevelView } from "@/api/inventory";
import * as studentsApi from "@/api/students";
import type { StudentView } from "@/api/students";
import { StockIssueModal } from "@/features/inventory/components/StockIssueModal";

vi.mock("@/api/inventory", async () => {
  const actual = await vi.importActual<typeof import("@/api/inventory")>("@/api/inventory");
  return { ...actual, issueStock: vi.fn() };
});

vi.mock("@/api/students", async () => {
  const actual = await vi.importActual<typeof import("@/api/students")>("@/api/students");
  return { ...actual, listStudents: vi.fn() };
});

const UNIFORM_LEVEL: StockLevelView = {
  itemId: "item-1",
  itemName: "Blue Uniform (Size 4)",
  itemTypeName: "School Uniform",
  unit: "piece",
  onHand: 7,
  reorderLevel: 10,
  lowStock: true,
  band: "LOW",
};

const GRACE: StudentView = {
  id: "student-1",
  schoolId: "school-1",
  branchId: "branch-1",
  admissionNumber: "KDL/2024/0031",
  firstName: "Grace",
  lastName: "Obi",
  fullName: "Grace Obi",
  gender: "FEMALE",
  admissionDate: "2020-09-01",
  status: "ACTIVE",
};

const MOVEMENT = {
  id: "movement-1",
  itemId: "item-1",
  itemName: "Blue Uniform (Size 4)",
  kind: "ISSUE" as const,
  quantity: -2,
  reason: null,
  reference: null,
  requisitionId: null,
  requisitionReference: null,
  studentId: "student-1",
  studentName: "Grace Obi",
  issuedTo: null,
  occurredOn: "2026-01-01",
  createdBy: "user-1",
  createdByName: "Ada Obi",
  createdAt: "2026-01-01T00:00:00Z",
};

describe("StockIssueModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the on-hand quantity and defaults to the Student recipient", async () => {
    render(<StockIssueModal level={UNIFORM_LEVEL} branchId="branch-1" onClose={vi.fn()} onSaved={vi.fn()} />);

    expect(screen.getByText("7 piece on hand.")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Student" })).toHaveAttribute("aria-checked", "true");
  });

  it("disables submit until a recipient is named", async () => {
    render(<StockIssueModal level={UNIFORM_LEVEL} branchId="branch-1" onClose={vi.fn()} onSaved={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Issue stock" })).toBeDisabled();
  });

  it("issues stock to a searched student", async () => {
    vi.mocked(studentsApi.listStudents).mockResolvedValue({
      content: [GRACE],
      totalElements: 1,
      totalPages: 1,
      number: 0,
      size: 10,
    });
    vi.mocked(inventoryApi.issueStock).mockResolvedValue(MOVEMENT);
    const onSaved = vi.fn();
    const onClose = vi.fn();
    const user = userEvent.setup();

    render(<StockIssueModal level={UNIFORM_LEVEL} branchId="branch-1" onClose={onClose} onSaved={onSaved} />);

    await user.type(screen.getByLabelText("Recipient"), "gra");
    await user.click(await screen.findByRole("option", { name: /Grace Obi/ }));
    await user.clear(screen.getByLabelText("Quantity"));
    await user.type(screen.getByLabelText("Quantity"), "2");
    await user.click(screen.getByRole("button", { name: "Issue stock" }));

    await waitFor(() =>
      expect(inventoryApi.issueStock).toHaveBeenCalledWith({
        branchId: "branch-1",
        itemId: "item-1",
        quantity: 2,
        studentId: "student-1",
        issuedTo: null,
        note: null,
        occurredOn: null,
      }),
    );
    expect(onSaved).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("switching to General usage enables submit with no text required", async () => {
    vi.mocked(inventoryApi.issueStock).mockResolvedValue(MOVEMENT);
    const user = userEvent.setup();

    render(<StockIssueModal level={UNIFORM_LEVEL} branchId="branch-1" onClose={vi.fn()} onSaved={vi.fn()} />);

    await user.click(screen.getByRole("radio", { name: "General usage" }));
    expect(screen.getByRole("button", { name: "Issue stock" })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "Issue stock" }));

    await waitFor(() =>
      expect(inventoryApi.issueStock).toHaveBeenCalledWith(
        expect.objectContaining({ studentId: null, issuedTo: null }),
      ),
    );
  });

  it("general usage may carry an optional used-for description", async () => {
    vi.mocked(inventoryApi.issueStock).mockResolvedValue(MOVEMENT);
    const user = userEvent.setup();

    render(<StockIssueModal level={UNIFORM_LEVEL} branchId="branch-1" onClose={vi.fn()} onSaved={vi.fn()} />);

    await user.click(screen.getByRole("radio", { name: "General usage" }));
    await user.type(screen.getByLabelText("Used for"), "PE department");
    await user.click(screen.getByRole("button", { name: "Issue stock" }));

    await waitFor(() =>
      expect(inventoryApi.issueStock).toHaveBeenCalledWith(
        expect.objectContaining({ studentId: null, issuedTo: "PE department" }),
      ),
    );
  });

  it("shows the server's error message on a refused issue", async () => {
    vi.mocked(inventoryApi.issueStock).mockRejectedValue(new ApiError(422, "Insufficient stock for Blue Uniform."));
    const user = userEvent.setup();

    render(<StockIssueModal level={UNIFORM_LEVEL} branchId="branch-1" onClose={vi.fn()} onSaved={vi.fn()} />);

    await user.click(screen.getByRole("radio", { name: "General usage" }));
    await user.click(screen.getByRole("button", { name: "Issue stock" }));

    expect(await screen.findByText("Insufficient stock for Blue Uniform.")).toBeInTheDocument();
  });
});

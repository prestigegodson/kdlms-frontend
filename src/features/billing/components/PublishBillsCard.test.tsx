import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as billingApi from "@/api/billing";
import type { BillPublicationPreflightView, BillPublicationView } from "@/api/billing";
import { PublishBillsCard } from "@/features/billing/components/PublishBillsCard";
import { resetAuthStore, useAuthStore } from "@/stores/authStore";
import { resetFeatureStore, useFeatureStore } from "@/stores/featureStore";

vi.mock("@/api/billing", async () => {
  const actual = await vi.importActual<typeof import("@/api/billing")>("@/api/billing");
  return {
    ...actual,
    getBillPublication: vi.fn(),
    getBillPublicationPreflight: vi.fn(),
    publishBills: vi.fn(),
    unpublishBills: vi.fn(),
    issueMissingBillDeliveries: vi.fn(),
  };
});

const UNPUBLISHED: BillPublicationView = {
  branchId: "branch-1",
  branchName: "Main Campus",
  termId: "term-1",
  termName: "First Term",
  published: false,
  publishedAt: null,
  deliveries: { pending: 0, processing: 0, sent: 0, sentWithoutBill: 0, cancelled: 0, failed: 0 },
};

const PUBLISHED: BillPublicationView = {
  ...UNPUBLISHED,
  published: true,
  publishedAt: "2026-09-01T00:00:00Z",
  deliveries: { pending: 0, processing: 0, sent: 12, sentWithoutBill: 0, cancelled: 0, failed: 0 },
};

const CLEAN_PREFLIGHT: BillPublicationPreflightView = {
  billableStudents: 12,
  studentsWithoutBill: 1,
  unpricedCompulsoryFees: [],
  expectedTotal: 60000,
  unpricedSelectedFees: [],
  unpricedTransportRoutes: [],
  advanceStudents: 0,
  unplannedLevels: [],
};

const GAPPY_PREFLIGHT: BillPublicationPreflightView = {
  billableStudents: 12,
  studentsWithoutBill: 1,
  unpricedCompulsoryFees: [
    { feeId: "fee-1", feeName: "Sports levy", levelId: "level-1", levelName: "Primary", affectedStudents: 5 },
  ],
  expectedTotal: 60000,
  unpricedSelectedFees: [],
  unpricedTransportRoutes: [],
  advanceStudents: 0,
  unplannedLevels: [],
};

function signIn(role: "SCHOOL_ADMIN" | "BRANCH_ADMIN" | "TEACHER" = "BRANCH_ADMIN") {
  resetAuthStore();
  resetFeatureStore();
  useAuthStore.setState({
    user: {
      id: "user-1",
      email: "admin@school.example",
      firstName: "A",
      lastName: "B",
      role,
      schoolId: "school-1",
      branchId: "branch-1",
    },
    accessToken: "access",
    refreshToken: "refresh",
  });
  useFeatureStore.setState({ billing: true, status: "loaded" });
}

describe("PublishBillsCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    signIn();
  });

  it("renders nothing for a role without publish access", () => {
    signIn("TEACHER");
    const { container } = render(<PublishBillsCard branchId="branch-1" termId="term-1" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows 'Not yet published' and a Publish button when unpublished", async () => {
    vi.mocked(billingApi.getBillPublication).mockResolvedValue(UNPUBLISHED);
    render(<PublishBillsCard branchId="branch-1" termId="term-1" />);

    expect(await screen.findByText("Not yet published")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Publish bills" })).toBeInTheDocument();
  });

  it("opens the preflight modal, shows the expected total, and publishes on confirm", async () => {
    vi.mocked(billingApi.getBillPublication).mockResolvedValue(UNPUBLISHED);
    vi.mocked(billingApi.getBillPublicationPreflight).mockResolvedValue(CLEAN_PREFLIGHT);
    vi.mocked(billingApi.publishBills).mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<PublishBillsCard branchId="branch-1" termId="term-1" currency="NGN" />);

    await user.click(await screen.findByRole("button", { name: "Publish bills" }));

    expect(await screen.findByText(/12 students on this branch will get a bill/)).toBeInTheDocument();
    expect(screen.getByText(/₦60,000.00/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Publish" }));

    await waitFor(() => expect(billingApi.publishBills).toHaveBeenCalledWith("term-1", "branch-1"));
  });

  it("names an unpriced compulsory gap and requires acknowledgement before confirming", async () => {
    vi.mocked(billingApi.getBillPublication).mockResolvedValue(UNPUBLISHED);
    vi.mocked(billingApi.getBillPublicationPreflight).mockResolvedValue(GAPPY_PREFLIGHT);
    const user = userEvent.setup();
    render(<PublishBillsCard branchId="branch-1" termId="term-1" />);

    await user.click(await screen.findByRole("button", { name: "Publish bills" }));

    expect(await screen.findByText(/Sports levy - Primary \(5 students affected\)/)).toBeInTheDocument();
    const confirmButton = screen.getByRole("button", { name: "Publish" });
    expect(confirmButton).toBeDisabled();

    await user.click(screen.getByRole("checkbox"));
    expect(confirmButton).toBeEnabled();
  });

  it("mentions advance bills in the summary and names an unplanned level, neither blocking confirmation", async () => {
    vi.mocked(billingApi.getBillPublication).mockResolvedValue(UNPUBLISHED);
    vi.mocked(billingApi.getBillPublicationPreflight).mockResolvedValue({
      ...CLEAN_PREFLIGHT,
      advanceStudents: 3,
      unplannedLevels: [{ levelId: "level-2", levelName: "Junior Secondary", activeStudents: 1 }],
    });
    const user = userEvent.setup();
    render(<PublishBillsCard branchId="branch-1" termId="term-1" currency="NGN" />);

    await user.click(await screen.findByRole("button", { name: "Publish bills" }));

    expect(await screen.findByText(/3 of these are advance bills for students not yet promoted/)).toBeInTheDocument();
    expect(screen.getByText(/Junior Secondary - 1 student/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Publish" })).toBeEnabled();
  });

  it("shows Unpublish and the late-joiner action once published, and queues missing deliveries", async () => {
    vi.mocked(billingApi.getBillPublication).mockResolvedValue(PUBLISHED);
    vi.mocked(billingApi.issueMissingBillDeliveries).mockResolvedValue({ queued: 3 });
    const user = userEvent.setup();
    render(<PublishBillsCard branchId="branch-1" termId="term-1" />);

    expect(await screen.findByText("Published")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Send bills to new students" }));

    expect(await screen.findByText("Queued 3 new bills.")).toBeInTheDocument();
    expect(billingApi.issueMissingBillDeliveries).toHaveBeenCalledWith("term-1", "branch-1");
  });
});

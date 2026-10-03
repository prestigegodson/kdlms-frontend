import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as levelsApi from "@/api/levels";
import type { LevelView } from "@/api/levels";
import * as sessionsApi from "@/api/sessions";
import type { AcademicSessionView, TermView } from "@/api/sessions";
import * as api from "@/api/staffFeePayments";
import type { CollectionSummaryView, PaymentQueuePage, QueueItem } from "@/api/staffFeePayments";
import { PaymentsTab } from "@/features/billing/pages/PaymentsTab";
import { resetAuthStore, useAuthStore } from "@/stores/authStore";
import { resetBranchStore } from "@/stores/branchStore";
import { resetFeatureStore, useFeatureStore } from "@/stores/featureStore";
import * as download from "@/utils/download";

vi.mock("@/api/staffFeePayments", async () => {
  const actual =
    await vi.importActual<typeof import("@/api/staffFeePayments")>("@/api/staffFeePayments");
  return {
    ...actual,
    listFeePayments: vi.fn(),
    getCollectionSummary: vi.fn(),
    exportFeePaymentsCsv: vi.fn(),
    getFeePayment: vi.fn(),
  };
});

vi.mock("@/api/levels", async () => {
  const actual = await vi.importActual<typeof import("@/api/levels")>("@/api/levels");
  return { ...actual, listLevels: vi.fn() };
});

vi.mock("@/api/sessions", async () => {
  const actual = await vi.importActual<typeof import("@/api/sessions")>("@/api/sessions");
  return { ...actual, listSessions: vi.fn(), listTerms: vi.fn() };
});

vi.mock("@/utils/download", () => ({ downloadBlob: vi.fn() }));

const SESSION: AcademicSessionView = {
  id: "session-1",
  schoolId: "school-1",
  name: "2026/2027",
  startDate: "2026-09-01",
  endDate: null,
  current: true,
};

const TERM: TermView = {
  id: "term-1",
  schoolId: "school-1",
  sessionId: "session-1",
  termNumber: 1,
  name: "First Term",
  startDate: "2026-09-01",
  endDate: "2026-12-01",
  current: true,
};

const LEVEL: LevelView = {
  id: "level-1",
  baseLevel: "PRIMARY",
  displayName: "Primary",
  rank: 1,
  status: "ACTIVE",
  subjectCount: 0,
  classCount: 1,
  subjectGroupCount: 0,
};

const ITEM: QueueItem = {
  paymentId: "payment-1",
  termId: "term-1",
  termName: "First Term",
  source: "GUARDIAN",
  payerName: "Gina Obi",
  paymentDate: "2026-09-20",
  method: "BANK_TRANSFER",
  totalAmount: 20000,
  currency: "NGN",
  status: "PENDING",
  createdAt: "2026-09-20T10:00:00Z",
  attachmentCount: 1,
  hiddenAllocationCount: 1,
  allocations: [
    {
      allocationId: "alloc-1",
      version: 1,
      studentId: "student-1",
      studentName: "Ada Obi",
      admissionNumber: "SCH/2026/0001",
      className: "Primary 1A",
      branchId: "branch-1",
      branchName: "Main",
      status: "PENDING",
      claimedAmount: 20000,
      confirmedAmount: null,
      settlement: null,
      reason: null,
      reviewedAt: null,
      receiptId: null,
      receiptNumber: null,
      possibleDuplicate: true,
    },
  ],
};

const PAGE: PaymentQueuePage = {
  items: [ITEM],
  page: 0,
  size: 20,
  totalElements: 1,
  totalPages: 1,
};

const TOTALS = {
  billed: 100000,
  confirmed: 40000,
  outstanding: 60000,
  pending: 20000,
  credit: 0,
  students: 2,
  billableStudents: 2,
  studentsByState: {},
};

const SUMMARY: CollectionSummaryView = {
  branchId: "branch-1",
  branchName: "Main",
  termId: "term-1",
  termName: "First Term",
  currency: "NGN",
  totals: TOTALS,
  byLevel: [{ levelId: "level-1", levelName: "Primary", totals: TOTALS }],
};

describe("PaymentsTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAuthStore();
    resetBranchStore();
    resetFeatureStore();
    useAuthStore.setState({
      user: {
        id: "user-1",
        email: "admin@school.example",
        firstName: "A",
        lastName: "B",
        role: "BRANCH_ADMIN",
        schoolId: "school-1",
        branchId: "branch-1",
      },
      accessToken: "access",
      refreshToken: "refresh",
    });
    useFeatureStore.setState({ billing: true, status: "loaded" });
    vi.mocked(levelsApi.listLevels).mockResolvedValue([LEVEL]);
    vi.mocked(sessionsApi.listSessions).mockResolvedValue({
      content: [SESSION],
      totalElements: 1,
      totalPages: 1,
      number: 0,
      size: 50,
    });
    vi.mocked(sessionsApi.listTerms).mockResolvedValue([TERM]);
    vi.mocked(api.listFeePayments).mockResolvedValue(PAGE);
    vi.mocked(api.getCollectionSummary).mockResolvedValue(SUMMARY);
    vi.mocked(api.exportFeePaymentsCsv).mockResolvedValue(new Blob(["csv"]));
  });

  it("opens on the pending queue for the current term, flagging a possible duplicate and hidden siblings", async () => {
    render(<PaymentsTab />);

    expect(await screen.findByText("Ada Obi")).toBeInTheDocument();
    expect(screen.getByText("Possible duplicate")).toBeInTheDocument();
    expect(
      screen.getByText(/One payment for 2 children \(1 in another branch\)/),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(api.listFeePayments).toHaveBeenLastCalledWith(
        { status: "PENDING", termId: "term-1" },
        0,
        20,
      ),
    );
  });

  it("passes every filter to the queue and to the CSV export", async () => {
    const user = userEvent.setup();
    render(<PaymentsTab />);
    await screen.findByText("Ada Obi");

    await user.selectOptions(screen.getByLabelText("Class"), "level-1");
    await user.selectOptions(screen.getByLabelText("Status"), "CONFIRMED");
    await user.selectOptions(screen.getByLabelText("Method"), "CASH");
    await user.type(screen.getByLabelText("Search"), "Ada");

    const expected = {
      termId: "term-1",
      levelId: "level-1",
      status: "CONFIRMED",
      method: "CASH",
      q: "Ada",
    };
    await waitFor(() => expect(api.listFeePayments).toHaveBeenLastCalledWith(expected, 0, 20));

    await user.click(screen.getByRole("button", { name: /Export CSV/ }));
    expect(api.exportFeePaymentsCsv).toHaveBeenCalledWith(expected);
    await waitFor(() =>
      expect(download.downloadBlob).toHaveBeenCalledWith(expect.any(Blob), "fee-payments.csv"),
    );
  });

  it("shows the collection summary for the term", async () => {
    render(<PaymentsTab />);

    // Each total appears in its tile and again in the by-class breakdown.
    expect(await screen.findAllByText("₦100,000.00")).toHaveLength(2);
    expect(screen.getAllByText("₦60,000.00")).toHaveLength(2);
    expect(api.getCollectionSummary).toHaveBeenCalledWith("term-1", undefined);
  });

  it("opens the review for a payment when its row is clicked", async () => {
    const user = userEvent.setup();
    vi.mocked(api.getFeePayment).mockReturnValue(new Promise(() => undefined));
    render(<PaymentsTab />);
    // The queue reloads once the current term resolves - click the row from that load.
    await waitFor(() =>
      expect(api.listFeePayments).toHaveBeenLastCalledWith(
        expect.objectContaining({ termId: "term-1" }),
        0,
        20,
      ),
    );

    await user.click(await screen.findByText("Ada Obi"));

    expect(api.getFeePayment).toHaveBeenCalledWith("payment-1");
    expect(screen.getByRole("dialog", { name: "Review payment" })).toBeInTheDocument();
  });
});

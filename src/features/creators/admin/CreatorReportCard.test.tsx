import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as dashboardApi from "@/api/dashboard";
import type { CreatorReportView } from "@/api/dashboard";
import * as billingApi from "@/api/subscriptionBilling";
import type { PaymentTransactionView } from "@/api/subscriptionBilling";
import { CreatorReportCard } from "@/features/creators/admin/CreatorReportCard";

vi.mock("@/api/dashboard", async () => {
  const actual = await vi.importActual<typeof import("@/api/dashboard")>("@/api/dashboard");
  return { ...actual, getCreatorReport: vi.fn() };
});

vi.mock("@/api/subscriptionBilling", async () => {
  const actual = await vi.importActual<typeof import("@/api/subscriptionBilling")>("@/api/subscriptionBilling");
  return { ...actual, listAdminPaymentTransactions: vi.fn() };
});

const REPORT: CreatorReportView = {
  classes: {
    total: 3,
    active: 2,
    archived: 1,
    sessionsHeld: 12,
    sessionsUpcoming: 4,
    sessionsCancelled: 1,
    sessionsLive: 0,
    hoursDelivered: 18.5,
    hoursUpcoming: 6,
  },
  learners: {
    total: 25,
    adults: 20,
    minors: 5,
    withLogin: 10,
    guardians: 4,
    pendingInvites: 2,
    activeEnrollments: 30,
    attendanceHours: 100,
  },
  quizzes: {
    total: 4,
    published: 3,
    drafts: 1,
    archived: 0,
    learnersAttempted: 17,
    attempts: 40,
    submittedAttempts: 36,
  },
  recentQuizzes: [
    {
      quizId: "quiz-1",
      title: "Fractions check",
      className: "Maths Year 5",
      status: "PUBLISHED",
      createdAt: "2026-10-30T10:00:00Z",
      learnersAttempted: 9,
      submitted: 8,
    },
  ],
  payments: [
    {
      currency: "NGN",
      paidMinor: 1_500_000,
      last30DaysMinor: 500_000,
      discountMinor: 0,
      successfulCharges: 3,
      pendingCharges: 2,
      pendingMinor: 250_000,
      failedCharges: 1,
      abandonedCharges: 1,
    },
    {
      currency: "USD",
      paidMinor: 4_900,
      last30DaysMinor: 0,
      discountMinor: 0,
      successfulCharges: 1,
      pendingCharges: 0,
      pendingMinor: 0,
      failedCharges: 0,
      abandonedCharges: 0,
    },
  ],
  lastPaidAt: "2026-10-20T10:00:00Z",
  generatedAt: "2026-11-02T10:00:00Z",
};

const TRANSACTION: PaymentTransactionView = {
  id: "tx-1",
  reference: "ref-abc",
  purpose: "CHECKOUT",
  status: "PENDING",
  packageId: "pkg-1",
  planName: "Tutor Pro",
  billingCycle: "MONTHLY",
  currency: "NGN",
  amountMinor: 250_000,
  discountMinor: 0,
  couponCode: null,
  gatewayMessage: null,
  paidAt: null,
  createdAt: "2026-11-01T10:00:00Z",
  schoolId: "tenant-1",
  schoolName: "Analytical Tutors",
};

function page(content: PaymentTransactionView[]) {
  return { content, totalElements: content.length, totalPages: 1, number: 0, size: 5 } as unknown as Awaited<
    ReturnType<typeof billingApi.listAdminPaymentTransactions>
  >;
}

describe("CreatorReportCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the tutor's activity, per-currency payments, and recent transactions", async () => {
    vi.mocked(dashboardApi.getCreatorReport).mockResolvedValue(REPORT);
    vi.mocked(billingApi.listAdminPaymentTransactions).mockResolvedValue(page([TRANSACTION]));
    const user = userEvent.setup();
    render(<CreatorReportCard schoolId="tenant-1" />);

    expect(await screen.findByText("Classes created")).toBeInTheDocument();
    expect(screen.getByText("2 active · 1 archived")).toBeInTheDocument();
    expect(screen.getByText("25")).toBeInTheDocument();
    expect(screen.getByText("18.5 h")).toBeInTheDocument();
    expect(screen.getByText("2 pending transactions")).toBeInTheDocument();
    expect(screen.getByText("ref-abc")).toBeInTheDocument();
    expect(screen.getByText("3 published · 1 drafts")).toBeInTheDocument();
    expect(screen.getByText("17")).toBeInTheDocument();
    expect(screen.getByText("36 submitted")).toBeInTheDocument();
    expect(screen.getByText("Fractions check")).toBeInTheDocument();
    expect(screen.getByText("Maths Year 5")).toBeInTheDocument();
    expect(billingApi.listAdminPaymentTransactions).toHaveBeenCalledWith("", 0, 5, "tenant-1");

    await user.click(screen.getByRole("tab", { name: "USD" }));
    expect(screen.getByText("0 pending transactions")).toBeInTheDocument();
    expect(screen.getByText("1 successful payments")).toBeInTheDocument();
  });

  it("shows an empty payments state for a tutor who never paid", async () => {
    vi.mocked(dashboardApi.getCreatorReport).mockResolvedValue({
      ...REPORT,
      payments: [],
      lastPaidAt: null,
      recentQuizzes: [],
    });
    vi.mocked(billingApi.listAdminPaymentTransactions).mockResolvedValue(page([]));
    render(<CreatorReportCard schoolId="tenant-1" />);

    expect(await screen.findByText("No payments yet.")).toBeInTheDocument();
    expect(screen.getByText("No quizzes yet.")).toBeInTheDocument();
    expect(screen.getByText("No successful payment yet")).toBeInTheDocument();
    expect(screen.queryByText("Recent transactions")).not.toBeInTheDocument();
  });

  it("shows an error without throwing when the report fails", async () => {
    vi.mocked(dashboardApi.getCreatorReport).mockRejectedValue(new Error("boom"));
    vi.mocked(billingApi.listAdminPaymentTransactions).mockResolvedValue(page([]));
    render(<CreatorReportCard schoolId="tenant-1" />);

    expect(await screen.findByText("Failed to load the tutor report")).toBeInTheDocument();
  });
});

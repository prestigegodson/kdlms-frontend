import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as billingApi from "@/api/billing";
import type { BillSummaryView, BillView, BranchBillingSummaryView } from "@/api/billing";
import * as classesApi from "@/api/classes";
import * as sessionsApi from "@/api/sessions";
import type { AcademicSessionView, TermView } from "@/api/sessions";
import { BillsTab } from "@/features/billing/pages/BillsTab";
import { resetAuthStore, useAuthStore } from "@/stores/authStore";
import { resetBranchStore } from "@/stores/branchStore";
import { resetFeatureStore, useFeatureStore } from "@/stores/featureStore";

vi.mock("@/api/billing", async () => {
  const actual = await vi.importActual<typeof import("@/api/billing")>("@/api/billing");
  return {
    ...actual,
    getBillingSummary: vi.fn(),
    getClassBills: vi.fn(),
    getStudentBill: vi.fn(),
    getBillPublication: vi.fn(),
    getStudentBillAdjustments: vi.fn(),
    saveStudentBillAdjustments: vi.fn(),
  };
});

vi.mock("@/api/classes", async () => {
  const actual = await vi.importActual<typeof import("@/api/classes")>("@/api/classes");
  return { ...actual, listClasses: vi.fn() };
});

vi.mock("@/api/sessions", async () => {
  const actual = await vi.importActual<typeof import("@/api/sessions")>("@/api/sessions");
  return { ...actual, listSessions: vi.fn(), listTerms: vi.fn() };
});

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

const CLASS_1 = {
  id: "class-1",
  schoolId: "school-1",
  branchId: "branch-1",
  levelId: "level-1",
  name: "Primary 1A",
  status: "ACTIVE" as const,
};

const SUMMARY: BranchBillingSummaryView = {
  branchId: "branch-1",
  branchName: "Main Campus",
  termId: "term-1",
  termName: "First Term",
  currency: "NGN",
  totalExpectedRevenue: 5000,
  byLevel: [{ levelId: "level-1", levelName: "Primary", billableStudentCount: 1, expectedRevenue: 5000 }],
};

const ROSTER: BillSummaryView[] = [
  {
    studentId: "student-1",
    studentName: "Ada Obi",
    admissionNumber: "SCH/2026/0001",
    billable: true,
    total: 5000,
    currency: "NGN",
    advance: false,
  },
  {
    studentId: "student-2",
    studentName: "Bola Ade",
    admissionNumber: "SCH/2026/0002",
    billable: false,
    total: 0,
    currency: "NGN",
    advance: false,
  },
];

const BILL: BillView = {
  studentId: "student-1",
  studentName: "Ada Obi",
  admissionNumber: "SCH/2026/0001",
  classId: "class-1",
  className: "Primary 1A",
  levelId: "level-1",
  levelName: "Primary",
  sessionId: "session-1",
  sessionName: "2026/2027",
  termId: "term-1",
  termName: "First Term",
  termNumber: 1,
  billReference: "SCH/2026/0001-T1",
  billable: true,
  chargedLines: [{ feeId: "fee-1", feeName: "Tuition", amount: 5000 }],
  optionalLines: [],
  transportFares: [],
  total: 5000,
  currency: "NGN",
  bankAccounts: [],
  instructions: null,
  advance: false,
};

const ADJUSTMENTS: billingApi.StudentBillAdjustmentsView = {
  studentId: "student-1",
  studentName: "Ada Obi",
  admissionNumber: "SCH/2026/0001",
  classId: "class-1",
  className: "Primary 1A",
  levelId: "level-1",
  levelName: "Primary",
  termId: "term-1",
  termName: "First Term",
  termNumber: 1,
  sessionId: "session-1",
  sessionName: "2026/2027",
  currency: "NGN",
  billable: true,
  published: false,
  fees: [
    {
      feeId: "fee-1",
      feeName: "Tuition",
      compulsory: true,
      applicableThisTerm: true,
      standardAmount: 5000,
      selected: false,
      overrideAmount: null,
      thisTermOnly: false,
      effectiveAmount: 5000,
    },
    {
      feeId: "fee-2",
      feeName: "Excursion",
      compulsory: false,
      applicableThisTerm: true,
      standardAmount: 2000,
      selected: false,
      overrideAmount: null,
      thisTermOnly: false,
      effectiveAmount: null,
    },
  ],
  extras: [],
  transport: {
    assignable: true,
    unassignableReason: null,
    routeId: null,
    direction: null,
    amount: null,
    routes: [],
  },
};

function signIn() {
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
}

describe("BillsTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    signIn();
    vi.mocked(classesApi.listClasses).mockResolvedValue({
      content: [CLASS_1],
      totalElements: 1,
      totalPages: 1,
      number: 0,
      size: 200,
    });
    vi.mocked(sessionsApi.listSessions).mockResolvedValue({
      content: [SESSION],
      totalElements: 1,
      totalPages: 1,
      number: 0,
      size: 50,
    });
    vi.mocked(sessionsApi.listTerms).mockResolvedValue([TERM]);
    vi.mocked(billingApi.getBillingSummary).mockResolvedValue(SUMMARY);
    vi.mocked(billingApi.getClassBills).mockResolvedValue(ROSTER);
    vi.mocked(billingApi.getStudentBill).mockResolvedValue(BILL);
    vi.mocked(billingApi.getStudentBillAdjustments).mockResolvedValue(ADJUSTMENTS);
    vi.mocked(billingApi.getBillPublication).mockResolvedValue({
      branchId: "branch-1",
      branchName: "Main Campus",
      termId: "term-1",
      termName: "First Term",
      published: false,
      publishedAt: null,
      deliveries: { pending: 0, processing: 0, sent: 0, sentWithoutBill: 0, cancelled: 0, failed: 0 },
    });
  });

  it("renders the roster and the summary tiles once a class is selected", async () => {
    const user = userEvent.setup();
    render(<BillsTab />);

    await user.selectOptions(await screen.findByLabelText("Class"), "class-1");

    expect(await screen.findByText("Ada Obi")).toBeInTheDocument();
    expect(screen.getByText("Bola Ade")).toBeInTheDocument();
    // Appears both in the summary StatTile and the roster's own Total column.
    expect(await screen.findAllByText("₦5,000.00")).toHaveLength(2);
  });

  it("shows a non-billable student as 'No bill' rather than omitting the row", async () => {
    const user = userEvent.setup();
    render(<BillsTab />);

    await user.selectOptions(await screen.findByLabelText("Class"), "class-1");

    expect(await screen.findByText("No bill")).toBeInTheDocument();
    expect(screen.getByText("Billed")).toBeInTheDocument();
  });

  it("clicking a roster row opens the bill preview for that student", async () => {
    const user = userEvent.setup();
    render(<BillsTab />);

    await user.selectOptions(await screen.findByLabelText("Class"), "class-1");
    await user.click(await screen.findByText("Ada Obi"));

    expect(billingApi.getStudentBill).toHaveBeenCalledWith("student-1", "term-1");
    expect(await screen.findByText(/SCH\/2026\/0001-T1/)).toBeInTheDocument();
    expect(screen.getByText("Tuition")).toBeInTheDocument();
  });

  it("renders the Advance bills card for a role that can manage advance-bill plans", async () => {
    render(<BillsTab />);

    expect(await screen.findByLabelText("Session to advance-bill")).toBeInTheDocument();
  });

  it("shows an Advance badge for a roster row billed against an advance plan", async () => {
    const user = userEvent.setup();
    vi.mocked(billingApi.getClassBills).mockResolvedValue([{ ...ROSTER[0], advance: true }]);
    render(<BillsTab />);

    await user.selectOptions(await screen.findByLabelText("Class"), "class-1");

    expect(await screen.findByText("Advance")).toBeInTheDocument();
  });

  it("clicking Edit bill opens the adjustments editor for that student without opening the preview", async () => {
    const user = userEvent.setup();
    render(<BillsTab />);

    await user.selectOptions(await screen.findByLabelText("Class"), "class-1");
    await user.click((await screen.findAllByRole("button", { name: "Edit bill" }))[0]);

    expect(billingApi.getStudentBillAdjustments).toHaveBeenCalledWith("student-1", "term-1");
    expect(await screen.findByText("Edit bill · Ada Obi")).toBeInTheDocument();
    expect(screen.getByText("Excursion")).toBeInTheDocument();
    expect(billingApi.getStudentBill).not.toHaveBeenCalled();
  });
});

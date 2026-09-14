import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as billingApi from "@/api/billing";
import type {
  AdvanceBillPlanView,
  AdvanceBillPreviewView,
  BillPublicationPreflightView,
  BillPublicationView,
  BillView,
  StudentBillAdjustmentsView,
} from "@/api/billing";
import * as levelsApi from "@/api/levels";
import type { LevelView } from "@/api/levels";
import * as sessionsApi from "@/api/sessions";
import type { AcademicSessionView, TermView } from "@/api/sessions";
import { AdvanceBillsTab } from "@/features/billing/pages/AdvanceBillsTab";
import { resetAuthStore, useAuthStore } from "@/stores/authStore";
import { resetBranchStore } from "@/stores/branchStore";
import { resetFeatureStore, useFeatureStore } from "@/stores/featureStore";

vi.mock("@/api/billing", async () => {
  const actual = await vi.importActual<typeof import("@/api/billing")>("@/api/billing");
  return {
    ...actual,
    getAdvanceBillPlans: vi.fn(),
    saveAdvanceBillPlans: vi.fn(),
    getAdvanceBillPreview: vi.fn(),
    getBillPublication: vi.fn(),
    getBillPublicationPreflight: vi.fn(),
    getStudentBill: vi.fn(),
    getStudentBillAdjustments: vi.fn(),
    saveStudentBillAdjustments: vi.fn(),
    getBillExport: vi.fn(),
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

const PRIMARY: LevelView = {
  id: "level-primary",
  baseLevel: "PRIMARY",
  displayName: "Primary",
  rank: 1,
  status: "ACTIVE",
  subjectCount: 0,
  classCount: 2,
  subjectGroupCount: 0,
};

const SECONDARY: LevelView = {
  id: "level-secondary",
  baseLevel: "SECONDARY",
  displayName: "Junior Secondary",
  rank: 2,
  status: "ACTIVE",
  subjectCount: 0,
  classCount: 0,
  subjectGroupCount: 0,
};

const SESSION_AHEAD: AcademicSessionView = {
  id: "session-2",
  schoolId: "school-1",
  name: "2027/2028",
  startDate: "2027-09-01",
  endDate: null,
  current: false,
};

const TERM_1: TermView = {
  id: "term-1",
  schoolId: "school-1",
  sessionId: "session-2",
  termNumber: 1,
  name: "First Term",
  startDate: "2027-09-01",
  endDate: "2027-12-01",
  current: false,
};

const PLAN_UNSET: AdvanceBillPlanView = {
  branchId: "branch-1",
  branchName: "Main Campus",
  sessionId: "session-2",
  sessionName: "2027/2028",
  levels: [
    { levelId: "level-primary", displayName: "Primary" },
    { levelId: "level-secondary", displayName: "Junior Secondary" },
  ],
  rows: [
    {
      sourceLevelId: "level-primary",
      sourceLevelName: "Primary",
      billingLevelId: null,
      billingLevelName: null,
      classCount: 2,
      activeStudents: 24,
      alreadyEnrolled: 0,
    },
  ],
};

const PLAN_SET: AdvanceBillPlanView = {
  ...PLAN_UNSET,
  rows: [
    {
      ...PLAN_UNSET.rows[0],
      billingLevelId: "level-secondary",
      billingLevelName: "Junior Secondary",
    },
  ],
};

const PREVIEW_WITH_STUDENTS: AdvanceBillPreviewView = {
  branchId: "branch-1",
  termId: "term-1",
  termName: "First Term",
  sourceLevelId: "level-primary",
  sourceLevelName: "Primary",
  billingLevelId: "level-secondary",
  billingLevelName: "Junior Secondary",
  currency: "NGN",
  billableStudents: 1,
  studentsWithoutBill: 0,
  expectedTotal: 20000,
  students: [
    {
      studentId: "student-1",
      studentName: "Ada Obi",
      admissionNumber: "SCH/2026/0001",
      className: "Primary 6A",
      billable: true,
      total: 20000,
      currency: "NGN",
      advance: true,
    },
  ],
};

const ADVANCE_BILL: BillView = {
  studentId: "student-1",
  studentName: "Ada Obi",
  admissionNumber: "SCH/2026/0001",
  classId: "class-1",
  className: "Primary 6A",
  levelId: "level-secondary",
  levelName: "Junior Secondary",
  sessionId: "session-2",
  sessionName: "2027/2028",
  termId: "term-1",
  termName: "First Term",
  termNumber: 1,
  billReference: "SCH/2026/0001-T1",
  billable: true,
  chargedLines: [{ feeId: "fee-1", feeName: "Tuition", amount: 20000 }],
  optionalLines: [],
  transportFares: [],
  total: 20000,
  currency: "NGN",
  bankAccounts: [],
  instructions: null,
  advance: true,
};

const ADVANCE_ADJUSTMENTS: StudentBillAdjustmentsView = {
  studentId: "student-1",
  studentName: "Ada Obi",
  admissionNumber: "SCH/2026/0001",
  classId: "class-1",
  className: "Primary 6A",
  levelId: "level-secondary",
  levelName: "Junior Secondary",
  termId: "term-1",
  termName: "First Term",
  termNumber: 1,
  sessionId: "session-2",
  sessionName: "2027/2028",
  currency: "NGN",
  billable: true,
  published: false,
  advance: true,
  fees: [
    {
      feeId: "fee-1",
      feeName: "Tuition",
      compulsory: true,
      applicableThisTerm: true,
      standardAmount: 20000,
      selected: false,
      overrideAmount: null,
      thisTermOnly: false,
      effectiveAmount: 20000,
    },
  ],
  extras: [],
  // Phase 29: an advance-billed student is assignable exactly like a real one once this branch has
  // a route priced for the session being billed in advance - see the "Edit bill button" test below,
  // which asserts the picker actually renders here rather than the old disabled placeholder text.
  transport: {
    assignable: true,
    unassignableReason: null,
    routeId: null,
    direction: null,
    amount: null,
    routes: [{ routeId: "route-1", routeName: "Ikeja", oneWayAmount: 5000, toAndFroAmount: 9000 }],
  },
};

const UNPUBLISHED: BillPublicationView = {
  branchId: "branch-1",
  branchName: "Main Campus",
  termId: "term-1",
  termName: "First Term",
  published: false,
  publishedAt: null,
  deliveries: { pending: 0, processing: 0, sent: 0, sentWithoutBill: 0, cancelled: 0, failed: 0 },
};

const CLEAN_PREFLIGHT: BillPublicationPreflightView = {
  billableStudents: 1,
  studentsWithoutBill: 0,
  unpricedCompulsoryFees: [],
  expectedTotal: 20000,
  unpricedSelectedFees: [],
  unpricedTransportRoutes: [],
  advanceStudents: 1,
  unplannedLevels: [],
};

function signIn() {
  resetAuthStore();
  resetFeatureStore();
  resetBranchStore();
  useAuthStore.setState({
    user: {
      id: "user-1",
      email: "admin@school.example",
      firstName: "A",
      lastName: "Dmin",
      role: "BRANCH_ADMIN",
      schoolId: "school-1",
      branchId: "branch-1",
    },
    accessToken: "access",
    refreshToken: "refresh",
  });
  useFeatureStore.setState({ billing: true, status: "loaded" });
}

describe("AdvanceBillsTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    signIn();
    vi.mocked(levelsApi.listLevels).mockResolvedValue([PRIMARY, SECONDARY]);
    vi.mocked(sessionsApi.listSessions).mockResolvedValue({
      content: [SESSION_AHEAD],
      totalElements: 1,
      totalPages: 1,
      number: 0,
      size: 50,
    });
    vi.mocked(sessionsApi.listTerms).mockResolvedValue([TERM_1]);
    vi.mocked(billingApi.getAdvanceBillPlans).mockResolvedValue(PLAN_UNSET);
    vi.mocked(billingApi.getBillPublication).mockResolvedValue(UNPUBLISHED);
    vi.mocked(billingApi.getBillPublicationPreflight).mockResolvedValue(CLEAN_PREFLIGHT);
    vi.mocked(billingApi.getBillExport).mockResolvedValue(null);
  });

  async function selectLevelAndSession(user: ReturnType<typeof userEvent.setup>) {
    render(<AdvanceBillsTab />);
    // Both selects exist immediately; their options populate once the async listLevels/
    // listSessions fetches resolve - wait for an actual option before selecting it.
    await within(screen.getByLabelText("Level")).findByText("Primary");
    await user.selectOptions(screen.getByLabelText("Level"), "level-primary");
    await within(screen.getByLabelText("Session to advance-bill")).findByText("2027/2028");
    await user.selectOptions(screen.getByLabelText("Session to advance-bill"), "session-2");
  }

  it("prompts to select a level and a session before showing anything else", async () => {
    render(<AdvanceBillsTab />);

    expect(await screen.findByText("Select a level and a session")).toBeInTheDocument();
  });

  it("saves the billing level for the selected source level", async () => {
    const user = userEvent.setup();
    vi.mocked(billingApi.saveAdvanceBillPlans).mockResolvedValue({
      outcomes: [{ sourceLevelId: "level-primary", success: true, message: null }],
    });
    await selectLevelAndSession(user);

    await user.selectOptions(await screen.findByLabelText("Bills at"), "level-secondary");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(billingApi.saveAdvanceBillPlans).toHaveBeenCalledWith(
        "session-2",
        [{ sourceLevelId: "level-primary", billingLevelId: "level-secondary" }],
        undefined,
      ),
    );
  });

  it("disables Save and shows the saved billing level when the level already has a plan row", async () => {
    const user = userEvent.setup();
    vi.mocked(billingApi.getAdvanceBillPlans).mockResolvedValue(PLAN_SET);
    await selectLevelAndSession(user);

    await screen.findByLabelText("Bills at");
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    expect(await screen.findByText("Saved — bills at Junior Secondary")).toBeInTheDocument();
  });

  it("enables Save and shows an unsaved-change hint once the billing level is changed", async () => {
    const user = userEvent.setup();
    vi.mocked(billingApi.getAdvanceBillPlans).mockResolvedValue(PLAN_SET);
    await selectLevelAndSession(user);
    await screen.findByLabelText("Bills at");

    await user.selectOptions(screen.getByLabelText("Bills at"), "level-primary");

    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
    expect(screen.getByText("Unsaved change")).toBeInTheDocument();
  });

  it("disables Save and explains an excluded level has no plan row to save", async () => {
    const user = userEvent.setup();
    await selectLevelAndSession(user);

    await screen.findByLabelText("Bills at");
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    expect(screen.getByText("Not advance-billed for this session")).toBeInTheDocument();
  });

  it("prompts to select a term before showing a preview", async () => {
    const user = userEvent.setup();
    await selectLevelAndSession(user);

    expect(await screen.findByText("Select a term")).toBeInTheDocument();
    expect(billingApi.getAdvanceBillPreview).not.toHaveBeenCalled();
  });

  it("renders the level bills export card once a term is selected, requesting the selected level and branch", async () => {
    const user = userEvent.setup();
    vi.mocked(billingApi.getAdvanceBillPreview).mockResolvedValue(PREVIEW_WITH_STUDENTS);
    await selectLevelAndSession(user);
    await user.selectOptions(await screen.findByLabelText("Term"), "term-1");

    expect(await screen.findByText("Level bills")).toBeInTheDocument();
    // branchId is undefined for a BRANCH_ADMIN - the server derives their branch from the token,
    // the same `useBranchScope` contract every other call in this tab already follows.
    await waitFor(() =>
      expect(billingApi.getBillExport).toHaveBeenCalledWith("level-primary", "term-1", undefined),
    );
  });

  it("shows a 'no billing level set' empty state when the level has no plan row", async () => {
    const user = userEvent.setup();
    vi.mocked(billingApi.getAdvanceBillPreview).mockResolvedValue({
      ...PREVIEW_WITH_STUDENTS,
      billingLevelId: null,
      billingLevelName: null,
      billableStudents: 0,
      expectedTotal: 0,
      students: [],
    });
    await selectLevelAndSession(user);
    await user.selectOptions(await screen.findByLabelText("Term"), "term-1");

    expect(await screen.findByText("No billing level set yet")).toBeInTheDocument();
  });

  it("shows a 'nothing to bill' empty state when every student is already promoted", async () => {
    const user = userEvent.setup();
    vi.mocked(billingApi.getAdvanceBillPlans).mockResolvedValue(PLAN_SET);
    vi.mocked(billingApi.getAdvanceBillPreview).mockResolvedValue({
      ...PREVIEW_WITH_STUDENTS,
      billableStudents: 0,
      expectedTotal: 0,
      students: [],
    });
    await selectLevelAndSession(user);
    await user.selectOptions(await screen.findByLabelText("Term"), "term-1");

    expect(await screen.findByText("Nothing to bill")).toBeInTheDocument();
  });

  it("keeps showing the billing-level picker (not the skeleton) when the level is reselected", async () => {
    const user = userEvent.setup();
    vi.mocked(billingApi.getAdvanceBillPlans).mockResolvedValue(PLAN_SET);
    await selectLevelAndSession(user);

    await screen.findByLabelText("Bills at");
    expect(billingApi.getAdvanceBillPlans).toHaveBeenCalledTimes(1);

    // Switch to a level with no plan row - the "no classes" alert, not a stuck skeleton.
    await user.selectOptions(await screen.findByLabelText("Level"), "level-secondary");
    expect(await screen.findByText("This level has no classes in this branch to advance-bill.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Bills at")).not.toBeInTheDocument();

    // Switch back - the picker returns immediately with the level's saved billing level, with no
    // extra fetch (the level axis never re-triggers `getAdvanceBillPlans`).
    await user.selectOptions(await screen.findByLabelText("Level"), "level-primary");
    expect(await screen.findByLabelText("Bills at")).toHaveValue("level-secondary");
    expect(billingApi.getAdvanceBillPlans).toHaveBeenCalledTimes(1);
  });

  it("keeps the selected term and re-previews when the level changes", async () => {
    const user = userEvent.setup();
    vi.mocked(billingApi.getAdvanceBillPlans).mockResolvedValue(PLAN_SET);
    vi.mocked(billingApi.getAdvanceBillPreview).mockResolvedValue(PREVIEW_WITH_STUDENTS);
    await selectLevelAndSession(user);
    await user.selectOptions(await screen.findByLabelText("Term"), "term-1");
    await screen.findByText("Ada Obi");

    await user.selectOptions(await screen.findByLabelText("Level"), "level-secondary");

    expect(screen.getByLabelText("Term")).toHaveValue("term-1");
    await waitFor(() =>
      expect(billingApi.getAdvanceBillPreview).toHaveBeenLastCalledWith(
        "session-2",
        "term-1",
        "level-secondary",
        undefined,
      ),
    );
  });

  it("shows the roster and totals once a plan and term produce advance bills, and mounts publishing", async () => {
    const user = userEvent.setup();
    vi.mocked(billingApi.getAdvanceBillPlans).mockResolvedValue(PLAN_SET);
    vi.mocked(billingApi.getAdvanceBillPreview).mockResolvedValue(PREVIEW_WITH_STUDENTS);
    await selectLevelAndSession(user);

    expect(screen.queryByText("Bill publication")).not.toBeInTheDocument();

    await user.selectOptions(await screen.findByLabelText("Term"), "term-1");

    expect(await screen.findByText("Ada Obi")).toBeInTheDocument();
    // Each row carries its own class - a level can span more than one.
    expect(screen.getByText("Primary 6A")).toBeInTheDocument();
    // Appears twice - once as the "Expected total" stat tile, once as the roster row's own total.
    expect(screen.getAllByText("₦20,000.00")).toHaveLength(2);
    expect(await screen.findByText("Bill publication")).toBeInTheDocument();
  });

  it("clicking a roster row opens the bill preview, not the adjustments editor", async () => {
    const user = userEvent.setup();
    vi.mocked(billingApi.getAdvanceBillPlans).mockResolvedValue(PLAN_SET);
    vi.mocked(billingApi.getAdvanceBillPreview).mockResolvedValue(PREVIEW_WITH_STUDENTS);
    vi.mocked(billingApi.getStudentBill).mockResolvedValue(ADVANCE_BILL);
    await selectLevelAndSession(user);
    await user.selectOptions(await screen.findByLabelText("Term"), "term-1");
    await screen.findByText("Ada Obi");

    await user.click(screen.getByText("Ada Obi"));

    expect(await screen.findByText("Bill preview")).toBeInTheDocument();
    expect(billingApi.getStudentBill).toHaveBeenCalledWith("student-1", "term-1");
    expect(billingApi.getStudentBillAdjustments).not.toHaveBeenCalled();
  });

  it("the Edit bill button opens the adjustments editor for the advance-billed student", async () => {
    const user = userEvent.setup();
    vi.mocked(billingApi.getAdvanceBillPlans).mockResolvedValue(PLAN_SET);
    vi.mocked(billingApi.getAdvanceBillPreview).mockResolvedValue(PREVIEW_WITH_STUDENTS);
    vi.mocked(billingApi.getStudentBillAdjustments).mockResolvedValue(ADVANCE_ADJUSTMENTS);
    await selectLevelAndSession(user);
    await user.selectOptions(await screen.findByLabelText("Term"), "term-1");
    await screen.findByText("Ada Obi");

    await user.click(screen.getByRole("button", { name: "Edit bill" }));

    expect(await screen.findByText("Edit bill · Ada Obi")).toBeInTheDocument();
    expect(billingApi.getStudentBillAdjustments).toHaveBeenCalledWith("student-1", "term-1");
    expect(billingApi.getStudentBill).not.toHaveBeenCalled();
    // The advance-bill note names the billing level and the session being advance-billed.
    const dialog = within(screen.getByRole("dialog"));
    expect(dialog.getByText("Advance bill")).toBeInTheDocument();
    expect(dialog.getByText(/Junior Secondary/)).toBeInTheDocument();
    // Phase 29: the School-bus picker itself renders here - an advance-billed student is no
    // longer hard-disabled from being assigned a route for the session they're billed in advance
    // for, once one is priced.
    expect(dialog.getByLabelText("Route")).toBeInTheDocument();
  });

  it("saving an adjustment refetches the preview", async () => {
    const user = userEvent.setup();
    vi.mocked(billingApi.getAdvanceBillPlans).mockResolvedValue(PLAN_SET);
    vi.mocked(billingApi.getAdvanceBillPreview).mockResolvedValue(PREVIEW_WITH_STUDENTS);
    vi.mocked(billingApi.getStudentBillAdjustments).mockResolvedValue(ADVANCE_ADJUSTMENTS);
    vi.mocked(billingApi.saveStudentBillAdjustments).mockResolvedValue(ADVANCE_ADJUSTMENTS);
    await selectLevelAndSession(user);
    await user.selectOptions(await screen.findByLabelText("Term"), "term-1");
    await screen.findByText("Ada Obi");
    expect(billingApi.getAdvanceBillPreview).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Edit bill" }));
    await screen.findByText("Edit bill · Ada Obi");
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Save" }));

    await waitFor(() => expect(billingApi.saveStudentBillAdjustments).toHaveBeenCalled());
    await waitFor(() => expect(billingApi.getAdvanceBillPreview).toHaveBeenCalledTimes(2));
  });
});
